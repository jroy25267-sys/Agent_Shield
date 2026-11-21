import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { SeverityText } from '../components/DecisionBadge';
import { ShellLayout } from '../components/ShellLayout';
import type { DashboardStatsResponse, SecurityThreatItem } from '../types/api';

const CATEGORIES = [
  'ALL',
  'PROMPT_INJECTION',
  'DLP_EXFILTRATION',
  'UNAUTHORIZED_ACCESS',
  'POLICY_VIOLATION',
  'SUSPICIOUS_DESTINATION',
  'RATE_LIMIT',
  'ANOMALY',
];

export default function ThreatsPage() {
  const [threats, setThreats] = useState<SecurityThreatItem[]>([]);
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [category, setCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [t, s] = await Promise.all([
        AgentShieldApi.getThreats(category === 'ALL' ? undefined : { category }),
        AgentShieldApi.getDashboardStats(),
      ]);
      setThreats(t);
      setStats(s);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ShellLayout
      title="Threat Intelligence"
      subtitle="Detected prompt injections, DLP exfiltration attempts, anomalies, and policy violations"
      primaryAction={
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-[#FFFFFF] hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Refresh
        </button>
      }
    >
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Policy Violation Analytics Chart */}
      {stats && stats.charts.violation_analytics.length > 0 && (
        <div className="p-6 rounded-xl bg-[#FFFFFF] border border-slate-200 space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Policy Violation & Threat Analytics
            </h2>
            <p className="text-xs text-slate-500">
              Frequency of security detections grouped by intelligence detector category
            </p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.violation_analytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="category" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#F8FAFC',
                    borderColor: '#334155',
                    color: '#F1F5F9',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Incidents" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Filter Bar */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              category === cat
                ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                : 'bg-[#FFFFFF] border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {cat === 'ALL' ? 'All Categories' : cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Threat Cards */}
      {loading && threats.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading threat intelligence...</div>
      ) : threats.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#FFFFFF] border border-slate-200 text-center text-sm text-slate-500">
          No security threats recorded in this category. Run security tests in the Attack Simulator to
          observe live detections.
        </div>
      ) : (
        <div className="space-y-4">
          {threats.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-xl bg-[#FFFFFF] border border-slate-200 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" aria-hidden="true" />
                  <span className="font-display text-sm font-semibold text-slate-900">
                    {t.category.replace(/_/g, ' ')}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <SeverityText severity={t.severity} />
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono text-xs text-slate-600">{t.agent_id}</span>
                </div>
                <div className="font-mono text-xs text-slate-500 tabular-nums">
                  {new Date(t.created_at).toLocaleString()}
                </div>
              </div>

              <p className="text-sm text-slate-700">{t.explanation}</p>

              <div className="grid md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200">
                  <div className="text-slate-500 mb-1">Captured Evidence</div>
                  <div className="font-mono text-amber-300 break-all">{t.evidence}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200">
                  <div className="text-slate-500 mb-1">Recommended Response</div>
                  <div className="text-slate-700">{t.recommended_action}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ShellLayout>
  );
}
