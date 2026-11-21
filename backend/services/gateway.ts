import type { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { sanitizeForAudit, verifyApiKey } from '../core/security';
import {
  getAgentRecord,
  getBehaviorProfile,
  getPolicyRecord,
  newId,
} from '../database/db';
import { detectAnomalies } from '../security/anomaly_detection';
import { detectSensitiveData } from '../security/dlp';
import { detectPromptInjection } from '../security/prompt_injection';
import { evaluateRateLimit } from '../security/rate_limiter';
import type {
  ActionExecuteRequest,
  ActionExecuteResponse,
  PolicyCheckResult,
  RiskBreakdownItem,
  ThreatSignal,
} from '../types';
import { executeControlledTool } from './execution_engine';
import { evaluatePolicies } from './policy_engine';

export class GatewayAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface GatewayExecutionOptions {
  apiKey: string;
  approvalTtlMinutes?: number;
}

export function executeAgentAction(
  db: DatabaseSync,
  req: ActionExecuteRequest,
  opts: GatewayExecutionOptions
): ActionExecuteResponse {
  const start = performance.now();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Validate Agent exists
  const agent = getAgentRecord(db, req.agent_id);
  if (!agent) {
    throw new GatewayAuthError(`Agent '${req.agent_id}' not found`, 404);
  }

  // 2. Authenticate Agent API Key
  if (!verifyApiKey(opts.apiKey, agent.api_key_hash)) {
    throw new GatewayAuthError('Invalid agent API key', 401);
  }

  // 3. Idempotency Check (prevent duplicate payment execution)
  if (req.idempotency_key) {
    const existing = db
      .prepare(`SELECT * FROM actions WHERE idempotency_key = ?`)
      .get(req.idempotency_key) as
      | {
          id: string;
          agent_id: string;
          action: string;
          decision: 'APPROVE' | 'BLOCK' | 'PAUSE';
          risk_score: number;
          risk_breakdown_json: string;
          policy_checks_json: string;
          reason: string;
          executed: number;
          execution_result_json: string | null;
          latency_ms: number;
          created_at: string;
        }
      | undefined;

    if (existing) {
      const existingAudit = db
        .prepare(`SELECT event_id FROM audit_logs WHERE action_id = ?`)
        .get(existing.id) as { event_id: string } | undefined;
      const existingApproval = db
        .prepare(`SELECT id FROM approvals WHERE action_id = ?`)
        .get(existing.id) as { id: string } | undefined;
      return {
        action_id: existing.id,
        event_id: existingAudit?.event_id || `EVT-${existing.id.slice(-6)}`,
        agent_id: existing.agent_id,
        action: existing.action,
        decision: existing.decision,
        risk_score: existing.risk_score,
        risk_breakdown: JSON.parse(existing.risk_breakdown_json) as RiskBreakdownItem[],
        policy_checks: JSON.parse(existing.policy_checks_json) as PolicyCheckResult[],
        threats: [],
        reason: `${existing.reason} (idempotent replay)`,
        executed: Boolean(existing.executed),
        execution_result: existing.execution_result_json
          ? JSON.parse(existing.execution_result_json)
          : null,
        approval_id: existingApproval?.id || null,
        latency_ms: existing.latency_ms,
        timestamp: existing.created_at,
      };
    }
  }

  const policy = getPolicyRecord(db, agent.id);
  if (!policy) {
    throw new GatewayAuthError(`No security policy configured for agent '${agent.id}'`, 500);
  }

  const lockdownRow = db
    .prepare(`SELECT value FROM system_state WHERE key = 'global_lockdown'`)
    .get() as { value: string } | undefined;
  const globalLockdown = lockdownRow?.value === 'true';

  // 4. Recent metrics for Rate Limiter, Daily Spend & Anomaly Detection
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const recentWindow = db
    .prepare(`SELECT COUNT(*) as c FROM actions WHERE agent_id = ? AND created_at >= ?`)
    .get(agent.id, oneMinuteAgo) as { c: number };

  const recentDenied = db
    .prepare(
      `SELECT COUNT(*) as c FROM actions WHERE agent_id = ? AND decision = 'BLOCK' AND created_at >= ?`
    )
    .get(agent.id, new Date(now.getTime() - 3600_000).toISOString()) as { c: number };

  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const dailySpendRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM simulated_transactions WHERE agent_id = ? AND created_at >= ?`
    )
    .get(agent.id, startOfDay.toISOString()) as { total: number };

  // 5. Security Intelligence Engine
  const rateCheck = evaluateRateLimit(recentWindow.c, policy.max_requests_per_minute);
  const injectionThreats = detectPromptInjection(req.parameters, req.context);
  const dlpThreats = detectSensitiveData(
    req.action,
    req.parameters,
    req.context,
    policy.allowed_recipients
  );
  const profile = getBehaviorProfile(db, agent.id);
  const amount = Number(req.parameters.amount || 0);
  const anomalyThreats = detectAnomalies({
    action: req.action,
    amount,
    recentActionCount60s: recentWindow.c + 1,
    recentDeniedCount: recentDenied.c,
    profile,
  });

  const combinedThreats: ThreatSignal[] = [
    ...(rateCheck.threat ? [rateCheck.threat] : []),
    ...injectionThreats,
    ...dlpThreats,
    ...anomalyThreats,
  ];

  // 6. Policy & Decision Engine
  const evaluation = evaluatePolicies({
    globalLockdown,
    agent,
    policy,
    action: req.action,
    parameters: req.parameters,
    dailySpendSoFar: dailySpendRow.total,
    rateLimitAllowed: rateCheck.allowed,
    threats: combinedThreats,
    context: req.context,
  });

  const actionId = newId('act');
  const eventId = `EVT-${actionId.slice(-8).toUpperCase()}`;
  const latencyMs = Number((performance.now() - start).toFixed(2));

  // Persist action BEFORE execution so Controlled Executor can verify decision
  db.prepare(
    `INSERT INTO actions (
      id, idempotency_key, agent_id, action, parameters_json, context_json,
      decision, risk_score, risk_breakdown_json, policy_checks_json, reason,
      executed, execution_result_json, latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    actionId,
    req.idempotency_key || null,
    agent.id,
    req.action,
    JSON.stringify(sanitizeForAudit(req.parameters)),
    JSON.stringify(sanitizeForAudit(req.context || {})),
    evaluation.decision,
    evaluation.risk_score,
    JSON.stringify(evaluation.risk_breakdown),
    JSON.stringify(evaluation.policy_checks),
    evaluation.reason,
    0,
    null,
    latencyMs,
    nowIso
  );

  // Persist detected security events
  const insertThreat = db.prepare(`
    INSERT INTO security_events (
      id, action_id, agent_id, category, severity, risk_contribution,
      evidence, explanation, recommended_action, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const threat of evaluation.threats) {
    insertThreat.run(
      newId('sec'),
      actionId,
      agent.id,
      threat.category,
      threat.severity,
      threat.risk_contribution,
      String(sanitizeForAudit(threat.evidence)),
      threat.explanation,
      threat.recommended_action,
      nowIso
    );
  }

  // 7. Execute ONLY if APPROVE, or create approval ticket if PAUSE
  let executed = false;
  let executionResult: Record<string, unknown> | null = null;
  let approvalId: string | null = null;

  if (evaluation.decision === 'APPROVE') {
    executionResult = executeControlledTool({
      db,
      actionId,
      agentId: agent.id,
      action: req.action,
      parameters: req.parameters,
      context: req.context,
    });
    executed = true;
    db.prepare(`UPDATE actions SET executed = 1, execution_result_json = ? WHERE id = ?`).run(
      JSON.stringify(executionResult),
      actionId
    );
  } else if (evaluation.decision === 'PAUSE') {
    approvalId = newId('apr');
    const ttlMinutes = opts.approvalTtlMinutes ?? 15;
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
    db.prepare(
      `INSERT INTO approvals (
        id, action_id, agent_id, action, parameters_json, risk_score,
        risk_breakdown_json, reason, status, decided_by, decision_note,
        expires_at, created_at, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      approvalId,
      actionId,
      agent.id,
      req.action,
      JSON.stringify(sanitizeForAudit(req.parameters)),
      evaluation.risk_score,
      JSON.stringify(evaluation.risk_breakdown),
      evaluation.reason,
      'PENDING',
      null,
      null,
      expiresAt,
      nowIso,
      null
    );
  }

  // 8. Update Agent Behavior Profile
  const nextTotal = (profile?.total_actions || 0) + 1;
  const nextCommon = { ...(profile?.common_actions || {}) };
  nextCommon[req.action] = (nextCommon[req.action] || 0) + 1;
  const nextAvg =
    amount > 0
      ? ((profile?.avg_amount || 0) * (profile?.total_actions || 0) + amount) / nextTotal
      : profile?.avg_amount || 0;
  const nextMax = Math.max(profile?.max_amount || 0, amount);
  const nextDenied = (profile?.denied_count || 0) + (evaluation.decision === 'BLOCK' ? 1 : 0);

  db.prepare(
    `INSERT INTO behavior_profiles (agent_id, total_actions, avg_amount, max_amount, common_actions_json, denied_count, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       total_actions = excluded.total_actions,
       avg_amount = excluded.avg_amount,
       max_amount = excluded.max_amount,
       common_actions_json = excluded.common_actions_json,
       denied_count = excluded.denied_count,
       last_updated = excluded.last_updated`
  ).run(agent.id, nextTotal, nextAvg, nextMax, JSON.stringify(nextCommon), nextDenied, nowIso);

  // 9. Write Audit Log (sanitized, zero secrets)
  const executionStatus = executed
    ? 'EXECUTED'
    : evaluation.decision === 'PAUSE'
      ? 'AWAITING_APPROVAL'
      : 'DENIED';

  db.prepare(
    `INSERT INTO audit_logs (
      event_id, action_id, agent_id, action, decision, risk_score,
      policy_checks_json, execution_status, explanation, approval_history_json,
      metadata_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    actionId,
    agent.id,
    req.action,
    evaluation.decision,
    evaluation.risk_score,
    JSON.stringify(evaluation.policy_checks),
    executionStatus,
    evaluation.reason,
    JSON.stringify([]),
    JSON.stringify({
      is_demo: false,
      parameters: sanitizeForAudit(req.parameters),
      rate_limited: !rateCheck.allowed,
    }),
    nowIso
  );

  return {
    action_id: actionId,
    event_id: eventId,
    agent_id: agent.id,
    action: req.action,
    decision: evaluation.decision,
    risk_score: evaluation.risk_score,
    risk_breakdown: evaluation.risk_breakdown,
    policy_checks: evaluation.policy_checks,
    threats: evaluation.threats,
    reason: evaluation.reason,
    executed,
    execution_result: executionResult,
    approval_id: approvalId,
    rate_limited: !rateCheck.allowed,
    latency_ms: latencyMs,
    timestamp: nowIso,
  };
}
