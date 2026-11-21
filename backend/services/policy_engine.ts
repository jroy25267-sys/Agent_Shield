import type {
  AgentRecord,
  DecisionType,
  PermissionName,
  PolicyCheckResult,
  PolicyConfig,
  ThreatSignal,
  ToolName,
} from '../types';
import { computeRiskScore } from './risk_engine';
import type { RiskBreakdownItem } from '../types';

const ACTION_TO_PERMISSION: Record<string, PermissionName> = {
  'invoice.read': 'invoice.read',
  'payment.create': 'payment.create',
  'notification.send': 'notification.send',
  'customer.read': 'customer.read',
  'database.read': 'database.read',
  'database.delete': 'database.read',
  'transaction.report': 'transaction.read',
};

const ACTION_TO_TOOL: Record<string, ToolName> = {
  'invoice.read': 'read_invoice',
  'payment.create': 'create_payment',
  'notification.send': 'send_notification',
  'customer.read': 'read_customer_pii',
  'database.read': 'query_database',
  'database.delete': 'query_database',
  'transaction.report': 'read_transactions',
};

export interface PolicyEvalInput {
  globalLockdown: boolean;
  agent: AgentRecord;
  policy: PolicyConfig;
  action: string;
  parameters: Record<string, unknown>;
  dailySpendSoFar: number;
  rateLimitAllowed: boolean;
  threats: ThreatSignal[];
  context?: Record<string, unknown>;
}

export interface PolicyEvalOutput {
  decision: DecisionType;
  risk_score: number;
  risk_breakdown: RiskBreakdownItem[];
  policy_checks: PolicyCheckResult[];
  threats: ThreatSignal[];
  reason: string;
}

export function evaluatePolicies(input: PolicyEvalInput): PolicyEvalOutput {
  const {
    globalLockdown,
    agent,
    policy,
    action,
    parameters,
    dailySpendSoFar,
    rateLimitAllowed,
  } = input;

  const threats: ThreatSignal[] = [...input.threats];
  const checks: PolicyCheckResult[] = [];

  const amount = Number(parameters.amount || 0);
  const recipient = String(parameters.recipient || parameters.to || '').trim();
  const resource = String(parameters.resource || parameters.table || '').trim();

  // 1. Global Lockdown Check
  if (globalLockdown) {
    checks.push({
      rule: 'Global Emergency Lockdown',
      passed: false,
      outcome: 'FAIL',
      detail: 'Platform-wide emergency kill switch is engaged.',
    });
  } else {
    checks.push({
      rule: 'Global Emergency Lockdown',
      passed: true,
      outcome: 'PASS',
      detail: 'No global lockdown active.',
    });
  }

  // 2. Agent Active Status
  const isAgentActive = agent.status === 'ACTIVE';
  checks.push({
    rule: 'Agent Identity & Active Status',
    passed: isAgentActive,
    outcome: isAgentActive ? 'PASS' : 'FAIL',
    detail: isAgentActive
      ? `Agent ${agent.name} (${agent.id}) is ACTIVE.`
      : `Agent ${agent.name} (${agent.id}) is REVOKED.`,
  });

  // 3. Permission Check
  const requiredPerm = ACTION_TO_PERMISSION[action];
  const hasPermission = Boolean(requiredPerm && agent.permissions.includes(requiredPerm));
  checks.push({
    rule: 'Permission Authorization',
    passed: hasPermission,
    outcome: hasPermission ? 'PASS' : 'FAIL',
    detail: hasPermission
      ? `Permission '${requiredPerm}' granted to agent.`
      : `Agent lacks required permission '${requiredPerm || action}'.`,
  });

  if (!hasPermission) {
    threats.push({
      category: 'UNAUTHORIZED_ACCESS',
      severity: 'CRITICAL',
      risk_contribution: 0, // already accounted for in computeRiskScore
      evidence: `Attempted action '${action}' without '${requiredPerm || action}' permission`,
      explanation: `Agent attempted an action outside its assigned permission scope.`,
      recommended_action: 'Block immediately and audit agent task instructions.',
    });
  }

  // 4. Permitted Tool Check
  const mappedTool = ACTION_TO_TOOL[action];
  const isToolPermitted = Boolean(mappedTool && policy.permitted_tools.includes(mappedTool));
  checks.push({
    rule: 'Permitted Tools Policy',
    passed: isToolPermitted,
    outcome: isToolPermitted ? 'PASS' : 'FAIL',
    detail: isToolPermitted
      ? `Tool '${mappedTool}' is permitted by policy.`
      : `Tool '${mappedTool || action}' is not allowed for this agent.`,
  });

  // 5. Restricted Resources Check
  const isRestrictedResource =
    resource.length > 0 && policy.restricted_resources.includes(resource);
  checks.push({
    rule: 'Restricted Resource Protection',
    passed: !isRestrictedResource,
    outcome: isRestrictedResource ? 'FAIL' : 'PASS',
    detail: isRestrictedResource
      ? `Resource '${resource}' is explicitly restricted by policy.`
      : 'No restricted resource targeted.',
  });

  // 6. Recipient Trust Check
  const isRestrictedRecipient =
    recipient.length > 0 && policy.restricted_recipients.includes(recipient);
  const isAllowedRecipient =
    recipient.length === 0 || policy.allowed_recipients.includes(recipient);

  if (isRestrictedRecipient) {
    checks.push({
      rule: 'Recipient Trust Verification',
      passed: false,
      outcome: 'FAIL',
      detail: `Recipient '${recipient}' is on the restricted/prohibited list.`,
    });
    threats.push({
      category: 'SUSPICIOUS_DESTINATION',
      severity: 'CRITICAL',
      risk_contribution: 0,
      evidence: `Prohibited recipient: ${recipient}`,
      explanation: `Action targeted a known restricted or blocklisted recipient.`,
      recommended_action: 'Block action and investigate origin of recipient address.',
    });
  } else if (!isAllowedRecipient && (action === 'payment.create' || action === 'notification.send')) {
    checks.push({
      rule: 'Recipient Trust Verification',
      passed: false,
      outcome: 'WARN',
      detail: `Recipient '${recipient}' is unknown (not in allowed_recipients).`,
    });
    threats.push({
      category: 'SUSPICIOUS_DESTINATION',
      severity: 'MEDIUM',
      risk_contribution: 0,
      evidence: `Unverified recipient: ${recipient}`,
      explanation: `Target recipient is not registered in the trusted recipient allowlist.`,
      recommended_action: 'Pause for human verification or add trusted vendor to policy.',
    });
  } else {
    checks.push({
      rule: 'Recipient Trust Verification',
      passed: true,
      outcome: 'PASS',
      detail: recipient ? `Recipient '${recipient}' is allowlisted.` : 'No external recipient specified.',
    });
  }

  // 7. Financial Limits (when payment.create)
  let withinTxLimit = true;
  let withinDailyLimit = true;
  if (action === 'payment.create') {
    if (amount <= 0 || Number.isNaN(amount)) {
      withinTxLimit = false;
      checks.push({
        rule: 'Transaction Amount Validation',
        passed: false,
        outcome: 'FAIL',
        detail: 'Payment amount must be a positive number.',
      });
    } else {
      withinTxLimit = amount <= policy.max_transaction_amount;
      checks.push({
        rule: 'Maximum Transaction Limit',
        passed: withinTxLimit,
        outcome: withinTxLimit ? 'PASS' : 'FAIL',
        detail: withinTxLimit
          ? `Amount ${amount} is within per-transaction cap (${policy.max_transaction_amount}).`
          : `Amount ${amount} exceeds max transaction cap (${policy.max_transaction_amount}).`,
      });
      if (!withinTxLimit) {
        threats.push({
          category: 'POLICY_VIOLATION',
          severity: 'HIGH',
          risk_contribution: 0,
          evidence: `Requested amount ${amount} > policy limit ${policy.max_transaction_amount}`,
          explanation: 'Payment request exceeds configured single-transaction monetary limit.',
          recommended_action: 'Block or require executive treasury approval.',
        });
      }
    }

    withinDailyLimit = dailySpendSoFar + Math.max(0, amount) <= policy.daily_spending_limit;
    checks.push({
      rule: 'Daily Spending Cap',
      passed: withinDailyLimit,
      outcome: withinDailyLimit ? 'PASS' : 'FAIL',
      detail: withinDailyLimit
        ? `Projected daily spend ${dailySpendSoFar + Math.max(0, amount)} <= ${policy.daily_spending_limit}.`
        : `Projected daily spend ${dailySpendSoFar + Math.max(0, amount)} exceeds daily limit ${policy.daily_spending_limit}.`,
    });
  }

  // 8. Rate Limit Check
  checks.push({
    rule: 'Per-Minute Rate Limit',
    passed: rateLimitAllowed,
    outcome: rateLimitAllowed ? 'PASS' : 'FAIL',
    detail: rateLimitAllowed
      ? `Within rate limit (${policy.max_requests_per_minute}/min).`
      : `Exceeded max ${policy.max_requests_per_minute} requests/min.`,
  });

  // 9. Prompt Injection & DLP Checks
  const hasInjection = threats.some((t) => t.category === 'PROMPT_INJECTION');
  const hasDlp = threats.some((t) => t.category === 'DLP_EXFILTRATION');
  checks.push({
    rule: 'Prompt Injection Shield',
    passed: !hasInjection,
    outcome: hasInjection ? 'FAIL' : 'PASS',
    detail: hasInjection
      ? 'Suspicious instruction override or jailbreak pattern detected.'
      : 'No prompt injection patterns detected.',
  });
  checks.push({
    rule: 'Data Loss Prevention (DLP)',
    passed: !hasDlp,
    outcome: hasDlp ? 'FAIL' : 'PASS',
    detail: hasDlp
      ? 'Sensitive data or credential exfiltration pattern detected.'
      : 'No sensitive data leakage detected.',
  });

  // Compute transparent 0-100 risk score
  const { risk_score, risk_breakdown } = computeRiskScore({
    action,
    amount,
    maxTransactionAmount: policy.max_transaction_amount,
    dailySpendSoFar,
    dailySpendingLimit: policy.daily_spending_limit,
    recipient,
    isAllowedRecipient,
    isRestrictedRecipient,
    hasPermission,
    isRestrictedResource,
    isToolPermitted,
    threats,
    demoId: input.context?.demo_id ? String(input.context.demo_id) : undefined,
  });

  // Deterministic Decision Matrix
  let decision: DecisionType = 'APPROVE';
  const blockReasons: string[] = [];
  const pauseReasons: string[] = [];

  if (globalLockdown) blockReasons.push('Global emergency kill switch is active');
  if (!isAgentActive) blockReasons.push(`Agent '${agent.id}' has been revoked`);
  if (!hasPermission) blockReasons.push(`Missing permission for '${action}'`);
  if (!isToolPermitted) blockReasons.push(`Tool '${mappedTool || action}' is not permitted`);
  if (isRestrictedResource) blockReasons.push(`Access to restricted resource '${resource}' is forbidden`);
  if (isRestrictedRecipient) blockReasons.push(`Recipient '${recipient}' is prohibited`);
  if (!rateLimitAllowed) blockReasons.push(`Rate limit exceeded (${policy.max_requests_per_minute}/min)`);
  if (hasInjection) blockReasons.push('Prompt injection attempt detected');
  if (hasDlp) blockReasons.push('Sensitive data exfiltration prevented by DLP');
  if (action === 'payment.create' && !withinTxLimit) {
    blockReasons.push(`Transaction amount ${amount} exceeds max limit ${policy.max_transaction_amount}`);
  }
  if (action === 'payment.create' && !withinDailyLimit) {
    blockReasons.push(`Daily spending limit (${policy.daily_spending_limit}) exceeded`);
  }

  if (blockReasons.length > 0) {
    decision = 'BLOCK';
  } else {
    if (!isAllowedRecipient && policy.require_approval_unknown_recipient && (action === 'payment.create' || action === 'notification.send')) {
      pauseReasons.push(`Recipient '${recipient}' is unknown and requires human approval`);
    }
    if (risk_score >= policy.high_risk_approval_threshold) {
      pauseReasons.push(
        `Risk score ${risk_score} meets or exceeds approval threshold (${policy.high_risk_approval_threshold})`
      );
    }
    if (pauseReasons.length > 0) {
      decision = 'PAUSE';
    }
  }

  const reason =
    decision === 'BLOCK'
      ? blockReasons.join('; ')
      : decision === 'PAUSE'
        ? pauseReasons.join('; ')
        : 'All security policies passed';

  return {
    decision,
    risk_score,
    risk_breakdown,
    policy_checks: checks,
    threats,
    reason,
  };
}
