import type { BehaviorProfile, ThreatSignal } from '../types';

export interface AnomalyInput {
  action: string;
  amount: number;
  recentActionCount60s: number;
  recentDeniedCount: number;
  profile: BehaviorProfile | null;
}

export function detectAnomalies(input: AnomalyInput): ThreatSignal[] {
  const threats: ThreatSignal[] = [];
  const { action, amount, recentActionCount60s, recentDeniedCount, profile } = input;

  // 1. Sudden activity spike
  if (recentActionCount60s >= 6) {
    threats.push({
      category: 'ANOMALY',
      severity: recentActionCount60s >= 10 ? 'HIGH' : 'MEDIUM',
      risk_contribution: recentActionCount60s >= 10 ? 25 : 15,
      evidence: `${recentActionCount60s} actions within trailing 60s window`,
      explanation: 'Agent action velocity significantly exceeds steady-state baseline.',
      recommended_action: 'Monitor agent task loop and verify no runaway automation is occurring.',
    });
  }

  // 2. Repeated denied actions
  if (recentDeniedCount >= 3) {
    threats.push({
      category: 'ANOMALY',
      severity: 'HIGH',
      risk_contribution: 25,
      evidence: `${recentDeniedCount} blocked actions in recent session history`,
      explanation: 'Repeated authorization denials indicate probing, compromised context, or faulty agent planning.',
      recommended_action: 'Review agent prompt history and consider temporary suspension.',
    });
  }

  // 3. Unusual transaction size vs baseline
  if (profile && profile.total_actions >= 3 && profile.avg_amount > 0 && amount > 0) {
    const ratio = amount / profile.avg_amount;
    if (ratio >= 4) {
      threats.push({
        category: 'ANOMALY',
        severity: ratio >= 10 ? 'HIGH' : 'MEDIUM',
        risk_contribution: ratio >= 10 ? 25 : 15,
        evidence: `Amount ${amount} is ${ratio.toFixed(1)}x baseline avg (${Math.round(profile.avg_amount)})`,
        explanation: 'Requested transaction deviates strongly from the agent historical spending fingerprint.',
        recommended_action: 'Require secondary verification before releasing funds.',
      });
    }
  }

  // 4. Unusual action type not in normal baseline
  if (profile && profile.total_actions >= 5 && !profile.common_actions[action]) {
    threats.push({
      category: 'ANOMALY',
      severity: 'MEDIUM',
      risk_contribution: 15,
      evidence: `First occurrence of '${action}' after ${profile.total_actions} baseline actions`,
      explanation: 'Agent invoked an action type absent from its established behavioral fingerprint.',
      recommended_action: 'Inspect intent context and confirm operational need.',
    });
  }

  return threats;
}
