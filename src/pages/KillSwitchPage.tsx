import { useCallback, useEffect, useState } from 'react';
import { Power, PowerOff, ShieldAlert } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { ShellLayout } from '../components/ShellLayout';
import { useAuth } from '../context/AuthContext';
import type { AgentItem } from '../types/api';

export default function KillSwitchPage() {
  const { globalLockdown, refreshSystemStatus } = useAuth();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    load();
  }, [load]);

  const toggleGlobalLockdown = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await AgentShieldApi.setLockdown(!globalLockdown);
      setNotice(
        res.global_lockdown
          ? 'Global Emergency Lockdown ENGAGED. All autonomous agent tool execution is halted.'
          : 'Global Emergency Lockdown LIFTED. Active agents may resume normal policy evaluation.'
      );
      await load();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleAgent = async (agent: AgentItem) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (agent.status === 'ACTIVE') {
        await AgentShieldApi.revokeAgent(agent.id, 'Emergency Kill Switch engaged by administrator');
        setNotice(`Agent '${agent.name}' (${agent.id}) has been REVOKED immediately.`);
      } else {
        await AgentShieldApi.activateAgent(agent.id);
        setNotice(`Agent '${agent.name}' (${agent.id}) has been REACTIVATED.`);
      }
      await load();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShellLayout
      title="Emergency Kill Switch"
      subtitle="Immediate revocation of autonomous agents and platform-wide tool execution lockdown"
    >
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
          {notice}
        </div>
      )}

      {/* Global Kill Switch */}
      <div
        className={`p-6 rounded-xl border space-y-4 ${
          globalLockdown
            ? 'bg-red-950/30 border-red-500/50'
            : 'bg-[#FFFFFF] border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={`w-5 h-5 ${globalLockdown ? 'text-red-400' : 'text-amber-400'}`}
                aria-hidden="true"
              />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Global Emergency Platform Lockdown
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl">
              Halts every agent tool invocation across the entire AgentShield gateway regardless of
              individual API key validity or permissions. All events are logged in the audit ledger.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={toggleGlobalLockdown}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              globalLockdown
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-red-600 hover:bg-red-500 text-slate-900'
            }`}
          >
            {globalLockdown ? (
              <>
                <Power className="w-4 h-4" aria-hidden="true" />
                Lift Global Lockdown
              </>
            ) : (
              <>
                <PowerOff className="w-4 h-4" aria-hidden="true" />
                Engage Global Kill Switch
              </>
            )}
          </button>
        </div>
      </div>

      {/* Per-Agent Revocation Controls */}
      <div className="rounded-xl bg-[#FFFFFF] border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Individual Agent Revocation Controls
          </h3>
        </div>
        {loading && agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading agents...</div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-base font-semibold text-slate-900">
                      {agent.name}
                    </span>
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
                  <div className="text-xs font-mono text-slate-500">
                    {agent.id} · Owner: {agent.owner}
                    {agent.revoked_at && ` · Revoked at ${new Date(agent.revoked_at).toLocaleString()}`}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleAgent(agent)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    agent.status === 'ACTIVE'
                      ? 'bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25'
                      : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  }`}
                >
                  {agent.status === 'ACTIVE' ? (
                    <>
                      <PowerOff className="w-3.5 h-3.5" aria-hidden="true" />
                      Revoke Immediately
                    </>
                  ) : (
                    <>
                      <Power className="w-3.5 h-3.5" aria-hidden="true" />
                      Restore Agent
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
