import type { ThreatSignal } from '../types';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  threat: ThreatSignal | null;
}

export function evaluateRateLimit(
  recentCountLastMinute: number,
  maxRequestsPerMinute: number
): RateLimitResult {
  const currentCount = recentCountLastMinute + 1;
  if (currentCount > maxRequestsPerMinute) {
    return {
      allowed: false,
      currentCount,
      limit: maxRequestsPerMinute,
      threat: {
        category: 'RATE_LIMIT',
        severity: 'HIGH',
        risk_contribution: 35,
        evidence: `${currentCount} requests/min exceeds configured limit of ${maxRequestsPerMinute}/min`,
        explanation: 'Agent exceeded its per-minute API execution quota.',
        recommended_action: 'Throttle agent requests (HTTP 429) and investigate potential loop or DoS behavior.',
      },
    };
  }

  return {
    allowed: true,
    currentCount,
    limit: maxRequestsPerMinute,
    threat: null,
  };
}
