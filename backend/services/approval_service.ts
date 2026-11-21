import type { DatabaseSync } from 'node:sqlite';
import { getAgentRecord, getPolicyRecord } from '../database/db';
import type { AdminUser, ApprovalRecord, RiskBreakdownItem } from '../types';
import { executeControlledTool } from './execution_engine';

export class ApprovalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function listApprovals(db: DatabaseSync): ApprovalRecord[] {
  const nowIso = new Date().toISOString();
  // Auto-mark expired pending approvals
  db.prepare(
    `UPDATE approvals SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= ?`
  ).run(nowIso);

  const rows = db
    .prepare(`SELECT * FROM approvals ORDER BY created_at DESC`)
    .all() as Array<{
    id: string;
    action_id: string;
    agent_id: string;
    action: string;
    parameters_json: string;
    risk_score: number;
    risk_breakdown_json: string;
    reason: string;
    status: ApprovalRecord['status'];
    decided_by: string | null;
    decision_note: string | null;
    expires_at: string;
    created_at: string;
    decided_at: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    action_id: r.action_id,
    agent_id: r.agent_id,
    action: r.action,
    parameters: JSON.parse(r.parameters_json),
    risk_score: r.risk_score,
    risk_breakdown: JSON.parse(r.risk_breakdown_json) as RiskBreakdownItem[],
    reason: r.reason,
    status: r.status,
    decided_by: r.decided_by,
    decision_note: r.decision_note,
    expires_at: r.expires_at,
    created_at: r.created_at,
    decided_at: r.decided_at,
  }));
}

export function decideApproval(
  db: DatabaseSync,
  approvalId: string,
  decision: 'APPROVE' | 'REJECT',
  admin: AdminUser,
  note?: string
): { approval: ApprovalRecord; executed: boolean; execution_result: Record<string, unknown> | null } {
  if (!admin || (admin.role !== 'admin' && admin.role !== 'security_lead')) {
    throw new ApprovalError('Administrator authorization required', 403);
  }

  const row = db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(approvalId) as
    | {
        id: string;
        action_id: string;
        agent_id: string;
        action: string;
        parameters_json: string;
        risk_score: number;
        risk_breakdown_json: string;
        reason: string;
        status: ApprovalRecord['status'];
        decided_by: string | null;
        decision_note: string | null;
        expires_at: string;
        created_at: string;
        decided_at: string | null;
      }
    | undefined;

  if (!row) {
    throw new ApprovalError(`Approval '${approvalId}' not found`, 404);
  }

  const nowIso = new Date().toISOString();
  if (row.status !== 'PENDING') {
    throw new ApprovalError(`Approval '${approvalId}' already finalized as ${row.status}`, 409);
  }
  if (row.expires_at <= nowIso) {
    db.prepare(`UPDATE approvals SET status = 'EXPIRED' WHERE id = ?`).run(approvalId);
    db.prepare(
      `UPDATE audit_logs SET execution_status = 'EXPIRED' WHERE action_id = ?`
    ).run(row.action_id);
    throw new ApprovalError(`Approval '${approvalId}' has expired and cannot be executed`, 410);
  }

  const parameters = JSON.parse(row.parameters_json) as Record<string, unknown>;
  const auditRow = db
    .prepare(`SELECT approval_history_json FROM audit_logs WHERE action_id = ?`)
    .get(row.action_id) as { approval_history_json: string } | undefined;
  const history = auditRow ? (JSON.parse(auditRow.approval_history_json) as Array<Record<string, unknown>>) : [];

  if (decision === 'REJECT') {
    db.prepare(
      `UPDATE approvals SET status = 'REJECTED', decided_by = ?, decision_note = ?, decided_at = ? WHERE id = ?`
    ).run(admin.email, note || 'Rejected by security administrator', nowIso, approvalId);

    db.prepare(`UPDATE actions SET decision = 'BLOCK', reason = ? WHERE id = ?`).run(
      `Human approval rejected by ${admin.email}: ${note || 'No note'}`,
      row.action_id
    );

    history.push({
      status: 'REJECTED',
      decided_by: admin.email,
      note: note || 'Rejected by administrator',
      timestamp: nowIso,
    });

    db.prepare(
      `UPDATE audit_logs SET decision = 'BLOCK', execution_status = 'REJECTED_BY_ADMIN', explanation = ?, approval_history_json = ? WHERE action_id = ?`
    ).run(
      `Human approval rejected by ${admin.email}`,
      JSON.stringify(history),
      row.action_id
    );

    const updated = listApprovals(db).find((a) => a.id === approvalId)!;
    return { approval: updated, executed: false, execution_result: null };
  }

  // Revalidate security policies & agent status before execution!
  const lockdown = db
    .prepare(`SELECT value FROM system_state WHERE key = 'global_lockdown'`)
    .get() as { value: string } | undefined;
  if (lockdown?.value === 'true') {
    throw new ApprovalError('Cannot execute while Global Emergency Lockdown is active', 409);
  }

  const agent = getAgentRecord(db, row.agent_id);
  if (!agent || agent.status !== 'ACTIVE') {
    throw new ApprovalError(`Agent '${row.agent_id}' is revoked or inactive; execution blocked`, 409);
  }

  const policy = getPolicyRecord(db, row.agent_id);
  if (!policy) {
    throw new ApprovalError(`Policy missing for agent '${row.agent_id}'`, 500);
  }

  const recipient = String(parameters.recipient || '');
  if (recipient && policy.restricted_recipients.includes(recipient)) {
    throw new ApprovalError(
      `Revalidation failed: recipient '${recipient}' is now restricted by policy`,
      409
    );
  }

  if (row.action === 'payment.create') {
    const amount = Number(parameters.amount || 0);
    if (amount > policy.max_transaction_amount) {
      throw new ApprovalError(
        `Revalidation failed: amount ${amount} exceeds max transaction limit (${policy.max_transaction_amount})`,
        409
      );
    }
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dailySpendRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM simulated_transactions WHERE agent_id = ? AND created_at >= ?`
      )
      .get(row.agent_id, startOfDay.toISOString()) as { total: number };
    if (dailySpendRow.total + amount > policy.daily_spending_limit) {
      throw new ApprovalError(
        `Revalidation failed: daily spending limit (${policy.daily_spending_limit}) would be exceeded`,
        409
      );
    }
  }

  // Mark action APPROVE, execute through controlled executor, and update approval & audit
  db.prepare(`UPDATE actions SET decision = 'APPROVE' WHERE id = ?`).run(row.action_id);

  const executionResult = executeControlledTool({
    db,
    actionId: row.action_id,
    agentId: row.agent_id,
    action: row.action,
    parameters,
  });

  db.prepare(`UPDATE actions SET executed = 1, execution_result_json = ? WHERE id = ?`).run(
    JSON.stringify(executionResult),
    row.action_id
  );

  db.prepare(
    `UPDATE approvals SET status = 'APPROVED', decided_by = ?, decision_note = ?, decided_at = ? WHERE id = ?`
  ).run(admin.email, note || 'Approved after manual verification', nowIso, approvalId);

  history.push({
    status: 'APPROVED',
    decided_by: admin.email,
    note: note || 'Approved after manual verification',
    timestamp: nowIso,
  });

  db.prepare(
    `UPDATE audit_logs SET decision = 'APPROVE', execution_status = 'EXECUTED_AFTER_APPROVAL', explanation = ?, approval_history_json = ? WHERE action_id = ?`
  ).run(
    `Approved by ${admin.email} and executed after policy revalidation`,
    JSON.stringify(history),
    row.action_id
  );

  const updated = listApprovals(db).find((a) => a.id === approvalId)!;
  return { approval: updated, executed: true, execution_result: executionResult };
}
