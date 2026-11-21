import type { DatabaseSync } from 'node:sqlite';
import { newId } from '../database/db';

export interface ControlledExecutionParams {
  db: DatabaseSync;
  actionId: string;
  agentId: string;
  action: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Controlled Tool Executor:
 * Enforces that NO action can execute unless its persisted action record
 * has been marked APPROVE (either immediately by PolicyEngine or via Admin Approval).
 */
export function executeControlledTool(params: ControlledExecutionParams): Record<string, unknown> {
  const { db, actionId, agentId, action, parameters, context } = params;

  const actionRow = db
    .prepare(`SELECT decision, executed, execution_result_json FROM actions WHERE id = ?`)
    .get(actionId) as
    | { decision: string; executed: number; execution_result_json: string | null }
    | undefined;

  if (!actionRow) {
    throw new Error('Gateway integrity check failed: Action record does not exist.');
  }
  if (actionRow.decision !== 'APPROVE') {
    throw new Error(
      `Gateway integrity check failed: Cannot execute action with decision '${actionRow.decision}'.`
    );
  }
  if (actionRow.executed === 1 && actionRow.execution_result_json) {
    return JSON.parse(actionRow.execution_result_json);
  }

  const now = new Date().toISOString();

  if (action === 'invoice.read') {
    const invoiceId = String(parameters.invoice_id || 'INV-2026-101');
    const invoice = db
      .prepare(`SELECT * FROM synthetic_invoices WHERE id = ?`)
      .get(invoiceId) as Record<string, unknown> | undefined;
    if (!invoice) {
      return {
        tool: 'read_invoice',
        status: 'SIMULATED_NOT_FOUND',
        invoice_id: invoiceId,
      };
    }
    return {
      tool: 'read_invoice',
      status: 'SIMULATED_SUCCESS',
      invoice,
    };
  }

  if (action === 'transaction.report') {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const transactions = db
      .prepare(
        `SELECT id, amount, currency, recipient, description, status, created_at
         FROM simulated_transactions
         WHERE created_at >= ?
         ORDER BY created_at DESC`
      )
      .all(startOfDay.toISOString()) as Array<Record<string, unknown>>;
    return {
      tool: 'read_transactions',
      status: 'SIMULATED_SUCCESS',
      period: 'today (UTC)',
      transaction_count: transactions.length,
      transactions,
    };
  }

  if (action === 'payment.create') {
    const amount = Number(parameters.amount || 0);
    const currency = String(parameters.currency || 'INR');
    const recipient = String(parameters.recipient || 'unknown');
    const description = String(
      context?.description || parameters.description || 'Agent payment execution'
    );
    const txnId = `TXN-${newId('').replace('-', '').toUpperCase()}`;

    db.prepare(
      `INSERT INTO simulated_transactions (id, action_id, agent_id, amount, currency, recipient, description, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(txnId, actionId, agentId, amount, currency, recipient, description, 'SIMULATED_SUCCESS', now);

    return {
      tool: 'create_payment',
      transaction_id: txnId,
      amount,
      currency,
      recipient,
      status: 'SIMULATED_SUCCESS',
      executed_at: now,
    };
  }

  if (action === 'notification.send') {
    const recipient = String(parameters.recipient || parameters.to || 'finance-ops@acme.internal');
    const channel = String(parameters.channel || 'email');
    const message = String(parameters.message || parameters.body || 'Automated notification');
    const notifId = `NTF-${newId('').replace('-', '').toUpperCase()}`;

    db.prepare(
      `INSERT INTO simulated_notifications (id, action_id, agent_id, recipient, channel, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(notifId, actionId, agentId, recipient, channel, message, 'SIMULATED_SENT', now);

    return {
      tool: 'send_notification',
      notification_id: notifId,
      recipient,
      channel,
      status: 'SIMULATED_SENT',
      sent_at: now,
    };
  }

  throw new Error(`Unsupported controlled tool action: ${action}`);
}
