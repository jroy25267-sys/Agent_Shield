import axios from 'axios';
import type {
  ActionResponse,
  AdminUser,
  AgentItem,
  ApprovalItem,
  AuditLogItem,
  DashboardStatsResponse,
  PolicyConfig,
  SecurityThreatItem,
  TestRunRecord,
  TestRunStats,
} from '../types/api';

const TOKEN_STORAGE_KEY = 'agentshield_admin_token';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    return err.message || 'API request failed';
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

export const AgentShieldApi = {
  async getGoogleClientId(): Promise<string | null> {
    const { data } = await api.get('/auth/google/config');
    return data.clientId;
  },

  async login(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  async loginWithGoogle(credential: string): Promise<{ token: string; user: AdminUser }> {
    const { data } = await api.post('/auth/google', { credential });
    return data;
  },

  async loginWithGoogleDemo(email?: string, name?: string): Promise<{ token: string; user: AdminUser }> {
    const { data } = await api.post('/auth/google/demo', { email, name });
    return data;
  },

  async me(): Promise<{ user: AdminUser }> {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },

  async getAgents(): Promise<AgentItem[]> {
    const { data } = await api.get('/agents');
    return data.agents;
  },

  async registerAgent(payload: {
    id?: string;
    name: string;
    description: string;
    owner: string;
    permissions: string[];
  }): Promise<{ agent: AgentItem; api_key: string; warning: string }> {
    const { data } = await api.post('/agents/register', payload);
    return data;
  },

  async revokeAgent(agentId: string, reason?: string): Promise<AgentItem> {
    const { data } = await api.post(`/agents/${agentId}/revoke`, { reason });
    return data.agent;
  },

  async activateAgent(agentId: string): Promise<AgentItem> {
    const { data } = await api.post(`/agents/${agentId}/activate`);
    return data.agent;
  },

  async getActions(params?: { limit?: number; decision?: string; agent_id?: string }): Promise<ActionResponse[]> {
    const { data } = await api.get('/actions', { params });
    return data.actions;
  },

  async getActionDetail(actionId: string): Promise<{
    action: ActionResponse;
    threats: SecurityThreatItem[];
    approval: ApprovalItem | null;
  }> {
    const { data } = await api.get(`/actions/${actionId}`);
    return data;
  },

  async executeWithKey(
    apiKey: string,
    payload: {
      agent_id: string;
      action: string;
      parameters: Record<string, unknown>;
      context?: Record<string, unknown>;
      idempotency_key?: string;
    }
  ): Promise<ActionResponse> {
    const { data } = await api.post('/actions/execute', payload, {
      headers: { 'x-agent-api-key': apiKey },
    });
    return data;
  },

  async getPolicy(agentId: string): Promise<PolicyConfig> {
    const { data } = await api.get(`/policies/${agentId}`);
    return data.policy;
  },

  async updatePolicy(agentId: string, policy: Partial<PolicyConfig>): Promise<PolicyConfig> {
    const { data } = await api.put(`/policies/${agentId}`, policy);
    return data.policy;
  },

  async getApprovals(): Promise<ApprovalItem[]> {
    const { data } = await api.get('/approvals');
    return data.approvals;
  },

  async decideApproval(
    approvalId: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string
  ): Promise<{ approval: ApprovalItem; executed: boolean; execution_result: Record<string, unknown> | null }> {
    const { data } = await api.post(`/approvals/${approvalId}/decide`, { decision, note });
    return data;
  },

  async getThreats(params?: { category?: string; severity?: string }): Promise<SecurityThreatItem[]> {
    const { data } = await api.get('/security/threats', { params });
    return data.threats;
  },

  async getAuditLogs(params?: {
    search?: string;
    decision?: string;
    agent_id?: string;
    sort?: string;
  }): Promise<AuditLogItem[]> {
    const { data } = await api.get('/audit-logs', { params });
    return data.logs;
  },

  async setLockdown(enabled: boolean): Promise<{ global_lockdown: boolean }> {
    const { data } = await api.post('/security/lockdown', { enabled });
    return data;
  },

  async runFinanceBot(prompt: string, agentId = 'finance-agent-01'): Promise<{
    agent_id: string;
    mode: 'gemini' | 'deterministic_mock';
    model: string;
    user_prompt: string;
    steps: Array<{
      step: number;
      stage: string;
      detail: string;
      tool_call?: { action: string; parameters: Record<string, unknown> };
      gateway_decision?: ActionResponse;
    }>;
    final_decision: string;
    assistant_message: string;
  }> {
    const { data } = await api.post('/agent/chat', { prompt, agent_id: agentId });
    return data;
  },

  async runScenario(
    scenarioId: string,
    custom?: {
      custom_action: string;
      custom_parameters: Record<string, unknown>;
      custom_context?: Record<string, unknown>;
    }
  ): Promise<{ scenario_id: string; results: ActionResponse[] }> {
    const { data } = await api.post('/simulator/scenario', {
      scenario_id: scenarioId,
      ...(custom || {}),
    });
    return data;
  },

  async runAllHackathonDemos(): Promise<{
    success: boolean;
    demos: Record<string, ActionResponse[]>;
  }> {
    const { data } = await api.post('/simulator/run-all-demos');
    return data;
  },

  async resetDemo(): Promise<{ message: string }> {
    const { data } = await api.post('/demo/reset');
    return data;
  },

  // ---- Test Runs Dataset & History Ledger ----

  async getTestRuns(params?: {
    test_id?: string;
    decision?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: TestRunRecord[];
    total: number;
    stats: TestRunStats;
  }> {
    const { data } = await api.get('/simulator/test-runs', { params });
    return data;
  },

  exportTestRunsUrl(format: 'csv' | 'json' = 'csv'): string {
    return `/api/simulator/test-runs/export?format=${format}`;
  },

  async seedTestRuns(): Promise<{ message: string; stats: TestRunStats }> {
    const { data } = await api.post('/simulator/test-runs/seed');
    return data;
  },

  async clearTestRuns(): Promise<{ message: string }> {
    const { data } = await api.post('/simulator/test-runs/clear');
    return data;
  },

  // ---- Genuine Gmail API Integration ----

  async getGmailStatus(): Promise<{
    connected: boolean;
    email?: string;
    scope?: string;
    expires_at?: number;
  }> {
    const { data } = await api.get('/gmail/status');
    return data;
  },

  async exchangeGmailOAuthCode(
    code: string,
    redirectUri?: string
  ): Promise<{
    success: boolean;
    connected: boolean;
    email: string;
    scope: string;
  }> {
    const { data } = await api.post('/gmail/oauth/callback', {
      code,
      redirect_uri: redirectUri || 'postmessage',
    });
    return data;
  },

  async disconnectGmail(): Promise<{ success: boolean; disconnected: boolean }> {
    const { data } = await api.post('/gmail/disconnect');
    return data;
  },

  async getGmailMessages(options?: {
    max_results?: number;
    q?: string;
    label_ids?: string[];
  }): Promise<{
    allowed: boolean;
    security_report: {
      actionId: string;
      auditEventId: string;
      action: string;
      decision: 'APPROVE' | 'BLOCK' | 'PAUSE';
      riskScore: number;
      riskBreakdown: Array<{ factor: string; contribution: number; detail: string }>;
      policyChecks: Array<{ policy_name: string; passed: boolean; severity: string; detail: string }>;
      reason: string;
      latencyMs: number;
      approvalId?: string | null;
      dlpFindings: string[];
    };
    messages: Array<{
      id: string;
      threadId: string;
      snippet: string;
      subject: string;
      from: string;
      to: string;
      date: string;
      internalDate: string;
      labels: string[];
    }>;
    total_estimated: number;
  }> {
    const { data } = await api.get('/gmail/messages', {
      params: options,
    });
    return data;
  },

  async getGmailMessageDetail(messageId: string): Promise<{
    allowed: boolean;
    security_report: {
      actionId: string;
      auditEventId: string;
      action: string;
      decision: 'APPROVE' | 'BLOCK' | 'PAUSE';
      riskScore: number;
      riskBreakdown: Array<{ factor: string; contribution: number; detail: string }>;
      policyChecks: Array<{ policy_name: string; passed: boolean; severity: string; detail: string }>;
      reason: string;
      latencyMs: number;
      dlpFindings: string[];
    };
    message: {
      id: string;
      threadId: string;
      snippet: string;
      subject: string;
      from: string;
      to: string;
      date: string;
      internalDate: string;
      labels: string[];
      bodyText: string;
      hasHtml: boolean;
      sizeEstimate: number;
    } | null;
  }> {
    const { data } = await api.get(`/gmail/messages/${messageId}`);
    return data;
  },
};
