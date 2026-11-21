import { useCallback, useEffect, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { DecisionBadge } from '../components/DecisionBadge';
import { ShellLayout } from '../components/ShellLayout';
import type { AuditLogItem } from '../types/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState('');
  const [sort, setSort] = useState('timestamp_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setError(null);
      const list = await AgentShieldApi.getAuditLogs({
        search: search.trim() || undefined,
        decision: decision || undefined,
        sort,
      });
      setLogs(list);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search, decision, sort]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <ShellLayout
      title="Audit Logs"
      subtitle="Immutable, sanitized security decision ledger with CSV export and full policy trace"
      primaryAction={
        <a
          href="/api/audit-logs/export"
          download="agentshield-audit-logs.csv"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Export CSV
        </a>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
          <label htmlFor="audit-search" className="sr-only">
            Search audit logs
          </label>
          <input
            id="audit-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event ID, agent, action, or explanation..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          aria-label="Filter by decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs text-slate-700"
        >
          <option value="">All Decisions</option>
          <option value="APPROVE">APPROVE</option>
          <option value="BLOCK">BLOCK</option>
          <option value="PAUSE">PAUSE</option>
        </select>

        <select
          aria-label="Sort audit logs"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs text-slate-700"
        >
          <option value="timestamp_desc">Newest First</option>
          <option value="risk_desc">Highest Risk First</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-[#FFFFFF] border border-slate-200 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No audit events match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F8FAFC] text-slate-500">
                  <th className="py-3 px-4 font-medium">Event ID</th>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Agent</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium text-right">Risk</th>
                  <th className="py-3 px-4 font-medium">Decision</th>
                  <th className="py-3 px-4 font-medium">Execution</th>
                  <th className="py-3 px-4 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {logs.map((log) => (
                  <tr key={log.event_id} className="hover:bg-slate-100/40">
                    <td className="py-3 px-4 font-mono text-sky-700 whitespace-nowrap">
                      {log.event_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {log.agent_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-right tabular-nums text-slate-900">
                      {log.risk_score}
                    </td>
                    <td className="py-3 px-4">
                      <DecisionBadge decision={log.decision} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{log.execution_status}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(log)}
                        className="px-2.5 py-1 rounded border border-slate-300 hover:border-sky-500 text-xs text-sky-700 whitespace-nowrap"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
        >
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-[#FFFFFF] border border-slate-300 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 id="audit-detail-title" className="font-display text-lg font-semibold text-slate-900">
                  Audit Event {selected.event_id}
                </h2>
                <div className="text-xs font-mono text-slate-500">
                  Action ID: {selected.action_id} · {selected.timestamp}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close audit detail modal"
                className="p-1.5 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-slate-200 space-y-1 text-xs">
              <div className="text-slate-500">Explanation</div>
              <div className="text-sm text-slate-900">{selected.explanation}</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Recorded Policy Checks</div>
              <pre className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-mono text-slate-600 overflow-x-auto">
                {JSON.stringify(
                  {
                    policy_checks: selected.policy_checks,
                    approval_history: selected.approval_history,
                    sanitized_metadata: selected.metadata,
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
