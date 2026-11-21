import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus, Power, PowerOff, X } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { ShellLayout } from '../components/ShellLayout';
import { useAuth } from '../context/AuthContext';
import type { AgentItem } from '../types/api';

const ALL_PERMISSIONS = [
  'invoice.read',
  'payment.create',
  'notification.send',
  'customer.read',
  'database.read',
  'transaction.read',
];

const ALL_TOOLS = [
  { tool: 'read_invoice', perm: 'invoice.read' },
  { tool: 'create_payment', perm: 'payment.create' },
  { tool: 'send_notification', perm: 'notification.send' },
  { tool: 'read_customer_pii', perm: 'customer.read' },
  { tool: 'query_database', perm: 'database.read' },
  { tool: 'read_transactions', perm: 'transaction.read' },
];

export default function AgentsPage() {
  const { refreshSystemStatus } = useAuth();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Register Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('Security Operations');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['invoice.read', 'payment.create']);
  const [creating, setCreating] = useState(false);

  // One-time key reveal
  const [revealedKey, setRevealedKey] = useState<{ agentId: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      setError(null);
      const list = await AgentShieldApi.getAgents();
      setAgents(list);
      await refreshSystemStatus();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [refreshSystemStatus]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await AgentShieldApi.registerAgent({
        name: name.trim(),
        description: description.trim() || 'Registered autonomous agent',
        owner: owner.trim() || 'Security Operations',
        permissions: selectedPerms,
      });
      setRevealedKey({ agentId: res.agent.id, apiKey: res.api_key });
      setShowModal(false);
      setName('');
      setDescription('');
      await loadAgents();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (agent: AgentItem) => {
    setError(null);
    try {
      if (agent.status === 'ACTIVE') {
        await AgentShieldApi.revokeAgent(agent.id, 'Revoked via Agent Management');
      } else {
        await AgentShieldApi.activateAgent(agent.id);
      }
      await loadAgents();
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ShellLayout
      title="Agent Management"
      subtitle="Register agents, inspect cryptographic key hashes, visualize tool permissions, and manage lifecycle"
      primaryAction={
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Register Agent
        </button>
      }
    >
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* One-time API Key Reveal Banner */}
      {revealedKey && (
        <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>One-Time Agent API Key Issued ({revealedKey.agentId})</span>
            </div>
            <button
              type="button"
              onClick={() => setRevealedKey(null)}
              aria-label="Dismiss API key banner"
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-700">
            Copy this credential now. AgentShield stores only its HMAC-SHA256 hash and will never
            display the raw key again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 font-mono text-xs text-emerald-300 overflow-x-auto">
              {revealedKey.apiKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Key'}
            </button>
          </div>
        </div>
      )}

      {loading && agents.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading registered agents...</div>
      ) : (
        <div className="space-y-6">
          {agents.map((agent) => {
            const profile = agent.behavior_profile;
            const policy = agent.policy;
            return (
              <div
                key={agent.id}
                className="p-6 rounded-xl bg-[#FFFFFF] border border-slate-200 space-y-5"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-lg font-bold text-slate-900">{agent.name}</h2>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded border ${
                          agent.status === 'ACTIVE'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-red-400 bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{agent.description}</p>
                    <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2 pt-1">
                      <span>ID: {agent.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>Owner: {agent.owner}</span>
                      <span aria-hidden="true">·</span>
                      <span>Key Prefix: {agent.api_key_prefix}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStatus(agent)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      agent.status === 'ACTIVE'
                        ? 'bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25'
                        : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    }`}
                  >
                    {agent.status === 'ACTIVE' ? (
                      <>
                        <PowerOff className="w-3.5 h-3.5" aria-hidden="true" />
                        Revoke Agent
                      </>
                    ) : (
                      <>
                        <Power className="w-3.5 h-3.5" aria-hidden="true" />
                        Reactivate Agent
                      </>
                    )}
                  </button>
                </div>

                {/* Tool Permission Visualization Matrix + Behavior Fingerprint */}
                <div className="grid lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-600">
                      Tool & Permission Access Matrix
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {ALL_TOOLS.map((item) => {
                        const hasPerm = agent.permissions.includes(item.perm);
                        const toolAllowed = policy?.permitted_tools.includes(item.tool) ?? false;
                        const effective = hasPerm && toolAllowed && agent.status === 'ACTIVE';
                        return (
                          <div
                            key={item.tool}
                            className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-mono text-slate-900">{item.tool}</div>
                              <div className="text-[11px] font-mono text-slate-500">
                                perm: {item.perm}
                              </div>
                            </div>
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                effective ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {effective ? 'ALLOWED' : 'DENIED'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-600">
                      Behavior Fingerprint
                    </div>
                    <div className="p-4 rounded-lg bg-[#FFFFFF] border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-slate-500">Total Actions</div>
                        <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                          {profile?.total_actions ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Denied Actions</div>
                        <div className="mt-1 font-mono text-lg font-bold text-red-400 tabular-nums">
                          {profile?.denied_count ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Avg Payment</div>
                        <div className="mt-1 font-mono text-base font-semibold text-sky-600 tabular-nums">
                          ₹{Math.round(profile?.avg_amount ?? 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Max Observed</div>
                        <div className="mt-1 font-mono text-base font-semibold text-amber-300 tabular-nums">
                          ₹{Math.round(profile?.max_amount ?? 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Agent Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-agent-title"
        >
          <form
            onSubmit={handleRegister}
            className="w-full max-w-lg rounded-xl bg-[#FFFFFF] border border-slate-300 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="register-agent-title" className="font-display text-lg font-semibold text-slate-900">
                Register Autonomous Agent
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close registration modal"
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="agent-name-input" className="block text-xs text-slate-600 mb-1">
                Agent Name
              </label>
              <input
                id="agent-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ProcurementBot"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="agent-desc-input" className="block text-xs text-slate-600 mb-1">
                Purpose & Scope
              </label>
              <input
                id="agent-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Automated PO verification agent"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="agent-owner-input" className="block text-xs text-slate-600 mb-1">
                Owning Team
              </label>
              <input
                id="agent-owner-input"
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-sm text-slate-900"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 mb-2">Granted Permissions</div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => {
                  const checked = selectedPerms.includes(perm);
                  return (
                    <label
                      key={perm}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-mono text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedPerms((prev) =>
                            checked ? prev.filter((p) => p !== perm) : [...prev, perm]
                          )
                        }
                      />
                      {perm}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold"
              >
                {creating ? 'Generating Key...' : 'Create Agent & Issue Key'}
              </button>
            </div>
          </form>
        </div>
      )}
    </ShellLayout>
  );
}
