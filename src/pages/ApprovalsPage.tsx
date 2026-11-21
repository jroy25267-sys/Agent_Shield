import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { SeverityText } from '../components/DecisionBadge';
import { ShellLayout } from '../components/ShellLayout';
import { useAuth } from '../context/AuthContext';
import type { ApprovalItem } from '../types/api';

export default function ApprovalsPage() {
  const { refreshSystemStatus } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      setError(null);
      const list = await AgentShieldApi.getApprovals();
      setApprovals(list);
      await refreshSystemStatus();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [refreshSystemStatus]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (approvalId: string, decision: 'APPROVE' | 'REJECT') => {
    setProcessingId(approvalId);
    setError(null);
    setFeedback(null);
    try {
      const res = await AgentShieldApi.decideApproval(approvalId, decision, notes[approvalId]);
      setFeedback(
        decision === 'APPROVE'
          ? `Approval ${approvalId} approved after policy revalidation. Executed: ${res.executed}`
          : `Approval ${approvalId} rejected; action remains blocked.`
      );
      await loadApprovals();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setProcessingId(null);
    }
  };

  const pending = approvals.filter((a) => a.status === 'PENDING');
  const history = approvals.filter((a) => a.status !== 'PENDING');

  return (
    <ShellLayout
      title="Approval Center"
      subtitle="Human-in-the-loop review queue with policy revalidation and expiry enforcement"
    >
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
          {feedback}
        </div>
      )}

      {/* Pending Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Pending Human Approvals ({pending.length})
          </h2>
        </div>

        {loading && approvals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading approval queue...</div>
        ) : pending.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#FFFFFF] border border-slate-200 text-center text-sm text-slate-500">
            No pending approvals in the queue. Trigger Test 3 (Unknown Recipient) in the Attack
            Simulator to test human-in-the-loop escalation.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => (
              <div
                key={item.id}
                className="p-6 rounded-xl bg-[#FFFFFF] border border-amber-500/30 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {item.action}
                      </span>
                      <span className="text-xs font-mono text-amber-300">
                        Risk {item.risk_score}/100
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{item.reason}</p>
                    <div className="text-xs font-mono text-slate-500">
                      Approval ID: {item.id} · Agent: {item.agent_id} · Expires:{' '}
                      {new Date(item.expires_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleDecision(item.id, 'APPROVE')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Approve & Execute
                    </button>
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleDecision(item.id, 'REJECT')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 disabled:opacity-50 text-red-300 text-xs font-semibold whitespace-nowrap"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1.5">
                      Requested Parameters
                    </div>
                    <pre className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-mono text-slate-700 overflow-x-auto">
                      {JSON.stringify(item.parameters, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1.5">Risk Breakdown</div>
                    <div className="space-y-1.5">
                      {item.risk_breakdown.map((rb, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-[#FFFFFF] border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-700">{rb.factor}</span>
                          <span className="font-mono text-amber-300 tabular-nums">
                            +{rb.points} · <SeverityText severity={rb.severity} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor={`note-${item.id}`} className="sr-only">
                    Reviewer note
                  </label>
                  <input
                    id={`note-${item.id}`}
                    type="text"
                    value={notes[item.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Optional administrator decision note..."
                    className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historical Decisions */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Approval Decision History ({history.length})
        </h2>
        <div className="rounded-xl bg-[#FFFFFF] border border-slate-200 overflow-hidden">
          {history.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No finalized approval decisions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-slate-500">
                    <th className="py-3 px-4 font-medium">Approval ID</th>
                    <th className="py-3 px-4 font-medium">Agent & Action</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Decided By</th>
                    <th className="py-3 px-4 font-medium">Note</th>
                    <th className="py-3 px-4 font-medium text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="py-3 px-4 font-mono text-slate-600">{h.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {h.agent_id} · {h.action}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        <span
                          className={
                            h.status === 'APPROVED'
                              ? 'text-emerald-400'
                              : h.status === 'REJECTED'
                                ? 'text-red-400'
                                : 'text-slate-500'
                          }
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{h.decided_by || '—'}</td>
                      <td className="py-3 px-4 text-slate-500">{h.decision_note || '—'}</td>
                      <td className="py-3 px-4 font-mono text-right text-slate-500 tabular-nums">
                        {new Date(h.decided_at || h.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </ShellLayout>
  );
}
