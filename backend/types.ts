export type DecisionType = 'APPROVE' | 'BLOCK' | 'PAUSE';

export type AgentStatus = 'ACTIVE' | 'REVOKED';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type PermissionName =
  | 'invoice.read'
  | 'payment.create'
  | 'notification.send'
  | 'customer.read'
  | 'database.read'
  | 'transaction.read'
  | 'gmail.read'
  | 'gmail.list';

export type ToolName =
  | 'read_invoice'
  | 'create_payment'
  | 'send_notification'
  | 'read_customer_pii'
  | 'query_database'
  | 'read_transactions'
  | 'list_gmail_messages'
  | 'read_gmail_message';

export interface AgentRecord {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  owner: string;
  api_key_prefix: string;
  permissions: PermissionName[];
  created_at: string;
  revoked_at: string | null;
}

export interface PolicyConfig {
  agent_id: string;
  max_transaction_amount: number;
  daily_spending_limit: number;
  allowed_recipients: string[];
  restricted_recipients: string[];
  permitted_tools: ToolName[];
  restricted_resources: string[];
  max_requests_per_minute: number;
  high_risk_approval_threshold: number;
  require_approval_unknown_recipient: boolean;
  updated_at: string;
}

export interface ThreatSignal {
  category:
    | 'PROMPT_INJECTION'
    | 'DLP_EXFILTRATION'
    | 'ANOMALY'
    | 'RATE_LIMIT'
    | 'UNAUTHORIZED_ACCESS'
    | 'POLICY_VIOLATION'
    | 'SUSPICIOUS_DESTINATION';
  severity: SeverityLevel;
  risk_contribution: number;
  evidence: string;
  explanation: string;
  recommended_action: string;
}

export interface RiskBreakdownItem {
  factor: string;
  points: number;
  severity: SeverityLevel;
  detail: string;
}

export interface TestRunRecord {
  id: string;
  batch_id: string | null;
  run_number: number;
  test_id: string;
  test_name: string;
  scenario_title: string;
  agent_id: string;
  user_request: string;
  action_attempted: string;
  decision: DecisionType;
  expected_decision: string;
  status: 'PASSED' | 'FAILED';
  risk_score: number;
  expected_risk: number;
  latency_ms: number;
  findings_summary: string;
  policy_checks_count: number;
  executed: boolean;
  run_by: string;
  created_at: string;
}

export interface TestRunStats {
  total_runs: number;
  passed_count: number;
  failed_count: number;
  pass_rate_pct: number;
  blocked_count: number;
  allowed_count: number;
  paused_count: number;
  avg_risk_score: number;
  avg_latency_ms: number;
}

export interface PolicyCheckResult {
  rule: string;
  passed: boolean;
  outcome: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
}

export interface ActionExecuteRequest {
  agent_id: string;
  action: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
  idempotency_key?: string;
}

export interface ActionExecuteResponse {
  action_id: string;
  event_id: string;
  agent_id: string;
  action: string;
  decision: DecisionType;
  risk_score: number;
  risk_breakdown: RiskBreakdownItem[];
  policy_checks: PolicyCheckResult[];
  threats: ThreatSignal[];
  reason: string;
  executed: boolean;
  execution_result: Record<string, unknown> | null;
  approval_id?: string | null;
  rate_limited?: boolean;
  latency_ms: number;
  timestamp: string;
}

export interface ApprovalRecord {
  id: string;
  action_id: string;
  agent_id: string;
  action: string;
  parameters: Record<string, unknown>;
  risk_score: number;
  risk_breakdown: RiskBreakdownItem[];
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  decided_by: string | null;
  decision_note: string | null;
  expires_at: string;
  created_at: string;
  decided_at: string | null;
}

export interface AuditLogEntry {
  event_id: string;
  action_id: string;
  agent_id: string;
  action: string;
  decision: DecisionType;
  risk_score: number;
  policy_checks: PolicyCheckResult[];
  execution_status: string;
  explanation: string;
  approval_history: Array<{
    status: string;
    decided_by: string | null;
    note: string | null;
    timestamp: string;
  }>;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface SecurityEventRecord {
  id: string;
  action_id: string;
  agent_id: string;
  category: ThreatSignal['category'];
  severity: SeverityLevel;
  risk_contribution: number;
  evidence: string;
  explanation: string;
  recommended_action: string;
  created_at: string;
}

export interface BehaviorProfile {
  agent_id: string;
  total_actions: number;
  avg_amount: number;
  max_amount: number;
  common_actions: Record<string, number>;
  denied_count: number;
  last_updated: string;
}

export interface SecurityPostureFactor {
  control: string;
  status: 'ENFORCED' | 'PARTIAL' | 'AT_RISK';
  score: number;
  max_score: number;
  detail: string;
}

export interface DashboardStats {
  registered_agents: number;
  active_agents: number;
  revoked_agents: number;
  actions_today: number;
  approved_actions: number;
  blocked_actions: number;
  paused_actions: number;
  pending_approvals: number;
  security_incidents: number;
  malicious_actions_detected: number;
  avg_decision_latency_ms: number;
  global_lockdown: boolean;
  llm_mode: 'gemini' | 'deterministic_mock';
  security_posture_score: number;
  security_posture_factors: SecurityPostureFactor[];
  charts: {
    decision_breakdown: Array<{ name: string; count: number; fill: string }>;
    timeline: Array<{ bucket: string; approved: number; blocked: number; paused: number; threats: number }>;
    risk_distribution: Array<{ range: string; count: number }>;
    agent_activity: Array<{ agent_id: string; actions: number; blocked: number; avg_risk: number }>;
    violation_analytics: Array<{ category: string; count: number }>;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'security_lead';
  picture?: string;
  google_id?: string;
}
