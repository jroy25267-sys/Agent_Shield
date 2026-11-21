import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { ShellLayout } from '../components/ShellLayout';
import type { AgentItem, PolicyConfig } from '../types/api';

const AVAILABLE_TOOLS = [
  'read_invoice',
  'create_payment',
  'send_notification',
  'read_customer_pii',
  'query_database',
];

export default function PoliciesPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('finance-agent-01');
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);

  const [allowedText, setAllowedText] = useState('');
  const [restrictedText, setRestrictedText] = useState('');
  const [resourcesText, setResourcesText] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadPolicy = useCallback(async (agentId: string) => {
    try {
      setError(null);
      setLoading(true);
      const [agentList, pol] = await Promise.all([
        AgentShieldApi.getAgents(),
        AgentShieldApi.getPolicy(agentId),
      ]);
      setAgents(agentList);
      setPolicy(pol);
      setAllowedText(pol.allowed_recipients.join(', '));
      setRestrictedText(pol.restricted_recipients.join(', '));
      setResourcesText(pol.restricted_resources.join(', '));
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicy(selectedAgentId);
  }, [loadPolicy, selectedAgentId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const splitCsv = (s: string) =>
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);

      const updated = await AgentShieldApi.updatePolicy(selectedAgentId, {
        max_transaction_amount: Number(policy.max_transaction_amount),
        daily_spending_limit: Number(policy.daily_spending_limit),
        max_requests_per_minute: Number(policy.max_requests_per_minute),
        high_risk_approval_threshold: Number(policy.high_risk_approval_threshold),
        require_approval_unknown_recipient: policy.require_approval_unknown_recipient,
        permitted_tools: policy.permitted_tools,
        allowed_recipients: splitCsv(allowedText),
        restricted_recipients: splitCsv(restrictedText),
        restricted_resources: splitCsv(resourcesText),
      });
      setPolicy(updated);
      setSavedMsg(`Policy saved for ${selectedAgentId} and enforced immediately at the gateway.`);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ShellLayout
      title="Policy Engine"
      subtitle="Configure deterministic monetary caps, recipient allowlists, permitted tools, and approval thresholds"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="policy-agent-select" className="text-xs font-medium text-slate-600">
            Target Agent:
          </label>
          <select
            id="policy-agent-select"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-xs font-mono text-slate-900"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.id})
              </option>
            ))}
          </select>
        </div>

        {policy && (
          <div className="text-xs font-mono text-slate-500">
            Last updated: {new Date(policy.updated_at).toLocaleString()}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
          {savedMsg}
        </div>
      )}

      {loading || !policy ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading security policy...</div>
      ) : (
        <form
          onSubmit={handleSave}
          className="p-6 rounded-xl bg-[#FFFFFF] border border-slate-200 space-y-6"
        >
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="pol-max-tx" className="block text-xs text-slate-600 mb-1">
                Max Transaction Amount (INR)
              </label>
              <input
                id="pol-max-tx"
                type="number"
                min={0}
                value={policy.max_transaction_amount}
                onChange={(e) =>
                  setPolicy({ ...policy, max_transaction_amount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-sm text-slate-900 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="pol-daily" className="block text-xs text-slate-600 mb-1">
                Daily Spending Limit (INR)
              </label>
              <input
                id="pol-daily"
                type="number"
                min={0}
                value={policy.daily_spending_limit}
                onChange={(e) =>
                  setPolicy({ ...policy, daily_spending_limit: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-sm text-slate-900 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="pol-rpm" className="block text-xs text-slate-600 mb-1">
                Max Requests / Minute
              </label>
              <input
                id="pol-rpm"
                type="number"
                min={1}
                value={policy.max_requests_per_minute}
                onChange={(e) =>
                  setPolicy({ ...policy, max_requests_per_minute: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-sm text-slate-900 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="pol-risk" className="block text-xs text-slate-600 mb-1">
                High-Risk Pause Threshold (0-100)
              </label>
              <input
                id="pol-risk"
                type="number"
                min={1}
                max={100}
                value={policy.high_risk_approval_threshold}
                onChange={(e) =>
                  setPolicy({ ...policy, high_risk_approval_threshold: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-sm text-slate-900 tabular-nums"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="pol-allowed" className="block text-xs text-slate-600 mb-1">
                Allowed Recipients (comma-separated)
              </label>
              <textarea
                id="pol-allowed"
                rows={3}
                value={allowedText}
                onChange={(e) => setAllowedText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-xs text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="pol-restricted" className="block text-xs text-slate-600 mb-1">
                Prohibited Recipients (comma-separated)
              </label>
              <textarea
                id="pol-restricted"
                rows={3}
                value={restrictedText}
                onChange={(e) => setRestrictedText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-xs text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="pol-resources" className="block text-xs text-slate-600 mb-1">
                Restricted Resources (comma-separated)
              </label>
              <textarea
                id="pol-resources"
                rows={3}
                value={resourcesText}
                onChange={(e) => setResourcesText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">Permitted Tools</div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOOLS.map((tool) => {
                const enabled = policy.permitted_tools.includes(tool);
                return (
                  <label
                    key={tool}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-mono text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() =>
                        setPolicy({
                          ...policy,
                          permitted_tools: enabled
                            ? policy.permitted_tools.filter((t) => t !== tool)
                            : [...policy.permitted_tools, tool],
                        })
                      }
                    />
                    {tool}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={policy.require_approval_unknown_recipient}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  require_approval_unknown_recipient: e.target.checked,
                })
              }
            />
            Require human approval (PAUSE) whenever recipient is outside the trusted allowlist
          </label>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              {saving ? 'Saving Policy...' : 'Save Security Policy'}
            </button>
          </div>
        </form>
      )}
    </ShellLayout>
  );
}
