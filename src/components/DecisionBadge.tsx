import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import type { DecisionType } from '../types/api';

export function DecisionBadge({ decision }: { decision: DecisionType | string }) {
  if (decision === 'APPROVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        APPROVE
      </span>
    );
  }
  if (decision === 'PAUSE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded whitespace-nowrap shrink-0">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        PAUSE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium text-red-400 bg-red-500/10 border border-red-500/25 rounded whitespace-nowrap shrink-0">
      <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
      BLOCK
    </span>
  );
}

export function SeverityText({ severity }: { severity: string }) {
  const color =
    severity === 'CRITICAL'
      ? 'text-red-400'
      : severity === 'HIGH'
        ? 'text-amber-400'
        : severity === 'MEDIUM'
          ? 'text-sky-600'
          : 'text-slate-500';

  return <span className={`font-mono text-xs font-semibold ${color}`}>{severity}</span>;
}
