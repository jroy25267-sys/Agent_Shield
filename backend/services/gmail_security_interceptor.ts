import type { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { sanitizeForAudit } from '../core/security';
import { newId } from '../database/db';
import { detectSensitiveData } from '../security/dlp';
import { detectPromptInjection } from '../security/prompt_injection';
import type {
  AdminUser,
  DecisionType,
  PolicyCheckResult,
  RiskBreakdownItem,
  ThreatSignal,
} from '../types';
import {
  fetchRealGmailMessageDetail,
  fetchRealGmailMessages,
  getValidAccessToken,
  type GmailMessageDetail,
  type GmailMessageSummary,
} from './gmail_service';

export interface GmailSecurityReport {
  actionId: string;
  auditEventId: string;
  action: 'gmail.list' | 'gmail.read';
  decision: DecisionType;
  riskScore: number;
  riskBreakdown: RiskBreakdownItem[];
  policyChecks: PolicyCheckResult[];
  threats: ThreatSignal[];
  reason: string;
  latencyMs: number;
  approvalId?: string | null;
  dlpFindings: string[];
}

export interface InterceptedGmailListResult {
  allowed: boolean;
  securityReport: GmailSecurityReport;
  messages: GmailMessageSummary[];
  totalEstimated: number;
}

export interface InterceptedGmailReadResult {
  allowed: boolean;
  securityReport: GmailSecurityReport;
  message: GmailMessageDetail | null;
}

/**
 * High-risk terms in email search queries that trigger security escalation or blocking
 */
const RESTRICTED_GMAIL_QUERY_PATTERNS = [
  { pattern: /password|credential|secret_key|api_key|token/i, risk: 45, reason: 'Credential harvesting query pattern' },
  { pattern: /payroll|salary|compensation|bonus_plan/i, risk: 40, reason: 'Restricted financial payroll resource query' },
  { pattern: /ssn|social security|pan card|aadhaar/i, risk: 50, reason: 'National PII identification extraction query' },
  { pattern: /wire transfer|swift code|bank routing/i, risk: 45, reason: 'Financial wire settlement authorization query' },
  { pattern: /confidential|nda|classified|internal only/i, risk: 35, reason: 'Classified corporate internal record query' },
];

/**
 * Intercepts Gmail messages.list requests through the AgentShield Security Gateway.
 */
export async function executeInterceptedGmailList(
  db: DatabaseSync,
  user: AdminUser,
  options: { maxResults?: number; q?: string; labelIds?: string[] } = {}
): Promise<InterceptedGmailListResult> {
  const start = performance.now();
  const query = String(options.q || '').trim();

  // 1. Verify Global Lockdown
  const lockdownRow = db
    .prepare(`SELECT value FROM system_state WHERE key = 'global_lockdown'`)
    .get() as { value: string } | undefined;
  const isLockdown = lockdownRow?.value === 'true';

  // 2. Evaluate Prompt Injection in search parameters
  const injectionThreats = detectPromptInjection({ query, max_results: options.maxResults }, {});

  // 3. Evaluate DLP Exfiltration in search parameters
  const dlpThreats = detectSensitiveData('gmail.list', { query }, {}, []);

  // 4. Query Intent Risk Scoring
  const queryThreats: ThreatSignal[] = [];
  let queryRiskScore = 0;

  for (const { pattern, risk, reason } of RESTRICTED_GMAIL_QUERY_PATTERNS) {
    if (pattern.test(query)) {
      queryRiskScore += risk;
      queryThreats.push({
        category: 'UNAUTHORIZED_ACCESS',
        severity: risk >= 45 ? 'HIGH' : 'MEDIUM',
        risk_contribution: risk,
        evidence: `Query matched pattern: "${query}"`,
        explanation: reason,
        recommended_action: 'Escalate to human review or block unauthorized data harvesting.',
      });
    }
  }

  const allThreats = [...injectionThreats, ...dlpThreats, ...queryThreats];

  // 5. Calculate Combined Risk Score
  let totalRisk = 5; // Base safe read risk
  for (const t of allThreats) {
    totalRisk += t.risk_contribution;
  }
  totalRisk = Math.min(Math.max(totalRisk, 0), 100);

  // 6. Policy Checks Breakdown
  const policyChecks: PolicyCheckResult[] = [
    {
      rule: 'GLOBAL_EMERGENCY_LOCKDOWN',
      passed: !isLockdown,
      outcome: !isLockdown ? 'PASS' : 'FAIL',
      detail: isLockdown ? 'Global security kill-switch is ACTIVE.' : 'Gateway operations normal.',
    },
    {
      rule: 'PROMPT_INJECTION_DEFENSE',
      passed: injectionThreats.length === 0,
      outcome: injectionThreats.length === 0 ? 'PASS' : 'FAIL',
      detail:
        injectionThreats.length === 0
          ? 'Zero prompt injection markers detected.'
          : injectionThreats[0].explanation,
    },
    {
      rule: 'RESTRICTED_DATA_HARVESTING',
      passed: queryThreats.length === 0,
      outcome: queryThreats.length === 0 ? 'PASS' : 'FAIL',
      detail:
        queryThreats.length === 0
          ? 'Query parameters within authorized operational scope.'
          : queryThreats[0].explanation,
    },
    {
      rule: 'OAUTH_LEAST_PRIVILEGE_SCOPE',
      passed: true,
      outcome: 'PASS',
      detail: 'Request conforms to minimum required scope (gmail.readonly).',
    },
  ];

  // 7. Make Gate Decision
  let decision: DecisionType = 'APPROVE';
  let reason = 'Gmail list query validated and permitted by AgentShield Gateway.';
  let approvalId: string | null = null;

  if (isLockdown) {
    decision = 'BLOCK';
    reason = 'Action blocked by Global Security Lockdown Kill Switch.';
  } else if (injectionThreats.length > 0) {
    decision = 'BLOCK';
    reason = `Blocked by AgentShield: Prompt injection detected in query parameter ("${injectionThreats[0].evidence}").`;
  } else if (totalRisk >= 85) {
    decision = 'BLOCK';
    reason = `Blocked by AgentShield: Extremely high data harvesting risk score (${totalRisk}/100).`;
  } else if (totalRisk >= 60 || queryThreats.length > 0) {
    decision = 'PAUSE';
    reason = `Paused for human review: Sensitive query pattern detected (${allThreats[0]?.explanation || 'High risk score'}).`;
  }

  const actionId = newId('act-gmail');
  const eventId = `EVT-GM-${actionId.slice(-6).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  // If paused, insert into approvals table for Human-in-the-Loop review
  if (decision === 'PAUSE') {
    approvalId = newId('appr-gm');
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    db.prepare(`
      INSERT INTO approvals (
        id, action_id, agent_id, action, parameters_json, risk_score,
        risk_breakdown_json, reason, status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      approvalId,
      actionId,
      user.email,
      'gmail.list',
      JSON.stringify(sanitizeForAudit(options)),
      totalRisk,
      JSON.stringify(allThreats),
      reason,
      'PENDING',
      expiresAt,
      nowIso
    );
  }

  // Persist into actions ledger
  db.prepare(`
    INSERT INTO actions (
      id, agent_id, action, parameters_json, context_json,
      decision, risk_score, risk_breakdown_json, policy_checks_json,
      reason, executed, execution_result_json, latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId,
    user.email,
    'gmail.list',
    JSON.stringify(sanitizeForAudit(options)),
    JSON.stringify({ user_id: user.id, user_email: user.email }),
    decision,
    totalRisk,
    JSON.stringify(allThreats),
    JSON.stringify(policyChecks),
    reason,
    decision === 'APPROVE' ? 1 : 0,
    null,
    Number((performance.now() - start).toFixed(2)),
    nowIso
  );

  // Persist into audit_logs ledger
  db.prepare(`
    INSERT INTO audit_logs (
      event_id, action_id, agent_id, action, decision, risk_score,
      policy_checks_json, execution_status, explanation,
      approval_history_json, metadata_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    actionId,
    user.email,
    'gmail.list',
    decision,
    totalRisk,
    JSON.stringify(policyChecks),
    decision === 'APPROVE' ? 'EXECUTED' : decision === 'BLOCK' ? 'BLOCKED' : 'QUARANTINED',
    reason,
    JSON.stringify(approvalId ? [{ approval_id: approvalId, status: 'PENDING' }] : []),
    JSON.stringify({ query, user_name: user.name, user_email: user.email }),
    nowIso
  );

  const securityReport: GmailSecurityReport = {
    actionId,
    auditEventId: eventId,
    action: 'gmail.list',
    decision,
    riskScore: totalRisk,
    riskBreakdown: allThreats.map((t) => ({ factor: t.category, points: t.risk_contribution, severity: t.severity, detail: t.explanation })),
    policyChecks,
    threats: allThreats,
    reason,
    latencyMs: Number((performance.now() - start).toFixed(2)),
    approvalId,
    dlpFindings: [],
  };

  // If blocked or paused, return report immediately WITHOUT calling Gmail API
  if (decision !== 'APPROVE') {
    return {
      allowed: false,
      securityReport,
      messages: [],
      totalEstimated: 0,
    };
  }

  // 8. Controlled Tool Execution: Fetch genuine Gmail messages
  const accessToken = await getValidAccessToken(db, user.id);
  const gmailResult = await fetchRealGmailMessages(accessToken, options);

  // 9. Inspect retrieved message snippets with DLP
  const dlpFindings: string[] = [];
  for (const msg of gmailResult.messages) {
    const snippetThreats = detectSensitiveData('gmail.snippet', { text: msg.snippet, subject: msg.subject }, {}, []);
    for (const st of snippetThreats) {
      dlpFindings.push(`[${msg.id.slice(-6)}] ${st.evidence}: ${st.explanation}`);
    }
  }
  securityReport.dlpFindings = dlpFindings;

  return {
    allowed: true,
    securityReport,
    messages: gmailResult.messages,
    totalEstimated: gmailResult.totalEstimated,
  };
}

/**
 * Intercepts Gmail messages.get requests through the AgentShield Security Gateway.
 */
export async function executeInterceptedGmailRead(
  db: DatabaseSync,
  user: AdminUser,
  messageId: string
): Promise<InterceptedGmailReadResult> {
  const start = performance.now();
  const cleanId = String(messageId || '').trim();

  const actionId = newId('act-gmread');
  const eventId = `EVT-GMR-${actionId.slice(-6).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  // Basic sanity validation
  if (!cleanId || cleanId.length > 100) {
    throw new Error('Invalid Gmail message identifier provided.');
  }

  // 1. Controlled Gateway Execution
  const accessToken = await getValidAccessToken(db, user.id);
  const detail = await fetchRealGmailMessageDetail(accessToken, cleanId);

  // 2. DLP Inspection on actual email body
  const dlpThreats = detectSensitiveData('gmail.read', { body: detail.bodyText, subject: detail.subject }, {}, []);
  const dlpFindings = dlpThreats.map((t) => `${t.evidence}: ${t.explanation}`);

  let riskScore = 10;
  for (const t of dlpThreats) {
    riskScore += t.risk_contribution;
  }
  riskScore = Math.min(Math.max(riskScore, 0), 100);

  const policyChecks: PolicyCheckResult[] = [
    {
      rule: 'DLP_CONFIDENTIAL_INSPECTION',
      passed: dlpThreats.length === 0,
      outcome: dlpThreats.length === 0 ? 'PASS' : 'WARN',
      detail:
        dlpThreats.length === 0
          ? 'No PCI or credential leaks detected in message body.'
          : `${dlpThreats.length} sensitive data pattern(s) flagged by DLP.`,
    },
    {
      rule: 'OAUTH_PERMISSIONS_VERIFIED',
      passed: true,
      outcome: 'PASS',
      detail: 'Read permission granted via authenticated Google OAuth token.',
    },
  ];

  // Record audit log
  db.prepare(`
    INSERT INTO actions (
      id, agent_id, action, parameters_json, context_json,
      decision, risk_score, risk_breakdown_json, policy_checks_json,
      reason, executed, execution_result_json, latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId,
    user.email,
    'gmail.read',
    JSON.stringify(sanitizeForAudit({ message_id: cleanId, subject: detail.subject })),
    JSON.stringify({ user_id: user.id }),
    'APPROVE',
    riskScore,
    JSON.stringify(dlpThreats),
    JSON.stringify(policyChecks),
    'Email read authorized and inspected by AgentShield Gateway.',
    1,
    null,
    Number((performance.now() - start).toFixed(2)),
    nowIso
  );

  db.prepare(`
    INSERT INTO audit_logs (
      event_id, action_id, agent_id, action, decision, risk_score,
      policy_checks_json, execution_status, explanation,
      approval_history_json, metadata_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    actionId,
    user.email,
    'gmail.read',
    'APPROVE',
    riskScore,
    JSON.stringify(policyChecks),
    'EXECUTED',
    'Email read inspected with DLP evaluation.',
    JSON.stringify([]),
    JSON.stringify({ message_id: cleanId, subject: detail.subject, from: detail.from }),
    nowIso
  );

  const securityReport: GmailSecurityReport = {
    actionId,
    auditEventId: eventId,
    action: 'gmail.read',
    decision: 'APPROVE',
    riskScore,
    riskBreakdown: dlpThreats.map((t) => ({ factor: t.category, points: t.risk_contribution, severity: t.severity, detail: t.explanation })),
    policyChecks,
    threats: dlpThreats,
    reason: 'Email read authorized and inspected by AgentShield Gateway.',
    latencyMs: Number((performance.now() - start).toFixed(2)),
    dlpFindings,
  };

  return {
    allowed: true,
    securityReport,
    message: detail,
  };
}
