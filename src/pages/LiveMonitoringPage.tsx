import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { DecisionBadge, SeverityText } from '../components/DecisionBadge';
import { ShellLayout } from '../components/ShellLayout';
import type { ActionResponse, ApprovalItem, SecurityThreatItem } from '../types/api';

export default function LiveMonitoringPage() {
  const [actions, setActions] = useState<ActionResponse[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [autoPoll, setAutoPoll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<{
    action: ActionResponse;
    threats: SecurityThreatItem[];
    approval: ApprovalItem | null;
  } | null>(null);

  const loadActions = useCallback(async () => {
    try {
      setError(null);
      const res = await AgentShieldApi.getActions({
        limit: 80,
        decision: filter === 'ALL' ? undefined : filter,
      });
      setActions(res);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  useEffect(() => {
    if (!autoPoll) return;
    const id = setInterval(loadActions, 5000);
    return () => clearInterval(id);
  }, [autoPoll, loadActions]);

  const inspectAction = async (actionId: string) => {
    try {
      const detail = await AgentShieldApi.getActionDetail(actionId);
      setSelectedDetail(detail);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  return (
    <ShellLayout
      title="Live Monitoring"
      subtitle="Real-time stream of every tool call intercepted by AgentShield with incident replay"
      primaryAction={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoPoll((p) => !p)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
              autoPoll
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-[#FFFFFF] border-slate-300 text-slate-600'
            }`}
          >
            Auto-Poll: {autoPoll ? 'On (5s)' : 'Paused'}
          </button>
          <button
            type="button"
            onClick={loadActions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-[#FFFFFF] hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>
      }
    >
      {/* Segmented Decision Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FFFFFF] border border-slate-200">
          {['ALL', 'APPROVE', 'BLOCK', 'PAUSE'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              {tab === 'ALL' ? 'All Decisions' : tab}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Showing {actions.length} intercepted actions · Baseline telemetry active
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-[#FFFFFF] border border-slate-200 overflow-hidden">
        {loading && actions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading intercepted actions...</div>
        ) : actions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No intercepted actions match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F8FAFC] text-slate-500">
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Agent</th>
                  <th className="py-3 px-4 font-medium">Action & Target</th>
                  <th className="py-3 px-4 font-medium text-right">Risk</th>
                  <th className="py-3 px-4 font-medium">Decision</th>
                  <th className="py-3 px-4 font-medium">Explanation</th>
                  <th className="py-3 px-4 font-medium text-right">Replay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {actions.map((act) => {
                  const target =
                    String(
                      act.parameters?.recipient ||
                        act.parameters?.resource ||
                        act.parameters?.invoice_id ||
                        '—'
                    ) +
                    (act.parameters?.amount ? ` (₹${act.parameters.amount})` : '');
                  const isDemo = Boolean(act.context?.is_demo);
                  return (
                    <tr key={act.action_id} className="hover:bg-slate-100/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {act.agent_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-900">{act.action}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                          {target}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-right tabular-nums text-slate-900">
                        {act.risk_score}/100
                      </td>
                      <td className="py-3 px-4">
                        <DecisionBadge decision={act.decision} />
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm truncate">
                        {act.reason}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => inspectAction(act.action_id)}
                          className="px-2.5 py-1 rounded border border-slate-300 hover:border-sky-500 text-xs text-sky-700 transition-colors whitespace-nowrap"
                        >
                          Inspect Trace
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Replay & Decision Trace Modal */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trace-modal-title"
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#FFFFFF] border border-slate-300 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 id="trace-modal-title" className="font-display text-lg font-semibold text-slate-900">
                  Incident Replay & Decision Trace
                </h2>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  {selectedDetail.action.action_id} · {selectedDetail.action.agent_id} ·{' '}
                  {selectedDetail.action.latency_ms} ms
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                aria-label="Close trace modal"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 border border-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-[#FFFFFF] border border-slate-200">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Gateway Verdict</div>
                <div className="flex items-center gap-3">
                  <DecisionBadge decision={selectedDetail.action.decision} />
                  <span className="text-sm text-slate-700">{selectedDetail.action.reason}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Risk Score</div>
                <div className="font-mono text-2xl font-bold text-sky-600 tabular-nums">
                  {selectedDetail.action.risk_score}/100
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-600">Risk Breakdown</h3>
                <div className="space-y-2">
                  {selectedDetail.action.risk_breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{item.factor}</span>
                        <span className="font-mono text-amber-300 tabular-nums">
                          +{item.points} pts · <SeverityText severity={item.severity} />
                        </span>
                      </div>
                      <p className="text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-600">Policy Checks</h3>
                <div className="space-y-1.5">
                  {selectedDetail.action.policy_checks.map((chk, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#FFFFFF] border border-slate-200 flex items-start justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-700">{chk.rule}</div>
                        <div className="text-slate-500 text-[11px]">{chk.detail}</div>
                      </div>
                      <span
                        className={`font-mono text-[11px] shrink-0 ${
                          chk.outcome === 'PASS'
                            ? 'text-emerald-400'
                            : chk.outcome === 'WARN'
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }`}
                      >
                        {chk.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-600">Parameters & Execution Result</h3>
              <pre className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-mono text-slate-600 overflow-x-auto">
                {JSON.stringify(
                  {
                    parameters: selectedDetail.action.parameters,
                    executed: selectedDetail.action.executed,
                    execution_result: selectedDetail.action.execution_result,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </ShellLayout>
  );
}
