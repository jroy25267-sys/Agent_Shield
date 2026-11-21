import type { ThreatSignal } from '../types';

interface InjectionRule {
  id: string;
  pattern: RegExp;
  label: string;
  weight: number;
  severity: ThreatSignal['severity'];
}

const INJECTION_RULES: InjectionRule[] = [
  {
    id: 'ignore-instructions',
    pattern: /\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?|policies?)\b/i,
    label: 'Instruction override directive',
    weight: 45,
    severity: 'CRITICAL',
  },
  {
    id: 'reveal-prompt',
    pattern: /\b(reveal|print|output|dump|show|leak)\s+(your\s+)?(system\s+prompt|hidden\s+instructions?|api\s*keys?|credentials?|secrets?)\b/i,
    label: 'System prompt or credential extraction attempt',
    weight: 40,
    severity: 'CRITICAL',
  },
  {
    id: 'bypass-security',
    pattern: /\b(bypass|disable|skip|circumvent)\s+(security|agentshield|policy|policies|approval|guardrails?|permissions?)\b/i,
    label: 'Security control bypass directive',
    weight: 50,
    severity: 'CRITICAL',
  },
  {
    id: 'exfiltrate-data',
    pattern: /\b(exfiltrate|forward|export|send\s+all|dump\s+database|steal)\b.{0,40}\b(external|attacker|outside|customer|pii|confidential|records?)\b/i,
    label: 'Data exfiltration instruction',
    weight: 45,
    severity: 'CRITICAL',
  },
  {
    id: 'ignore-permissions',
    pattern: /\b(ignore\s+tool\s+permissions?|act\s+as\s+root|sudo\s+mode|developer\s+mode|unrestricted\s+mode|jailbreak)\b/i,
    label: 'Privilege escalation / jailbreak phrasing',
    weight: 35,
    severity: 'HIGH',
  },
  {
    id: 'spoofed-system-tag',
    pattern: /(<\/?system>|\[SYSTEM\]|###\s*SYSTEM\s*OVERRIDE|BEGIN\s+ADMIN\s+COMMAND)/i,
    label: 'Spoofed system delimiter tag',
    weight: 35,
    severity: 'HIGH',
  },
];

export function detectPromptInjection(
  parameters: Record<string, unknown>,
  context?: Record<string, unknown>
): ThreatSignal[] {
  const combinedText = JSON.stringify({ parameters, context: context || {} });
  const threats: ThreatSignal[] = [];
  const matchedLabels = new Set<string>();

  for (const rule of INJECTION_RULES) {
    const match = combinedText.match(rule.pattern);
    if (match && !matchedLabels.has(rule.label)) {
      matchedLabels.add(rule.label);
      threats.push({
        category: 'PROMPT_INJECTION',
        severity: rule.severity,
        risk_contribution: rule.weight,
        evidence: match[0].slice(0, 140),
        explanation: `Detected ${rule.label.toLowerCase()} embedded inside structured tool arguments or context.`,
        recommended_action: 'Block unauthorized execution and quarantine the upstream prompt/document source.',
      });
    }
  }

  return threats;
}
