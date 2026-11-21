import type { ThreatSignal } from '../types';

function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function detectSensitiveData(
  action: string,
  parameters: Record<string, unknown>,
  context: Record<string, unknown> | undefined,
  allowedRecipients: string[]
): ThreatSignal[] {
  const threats: ThreatSignal[] = [];
  const serialized = JSON.stringify({ parameters, context: context || {} });
  const recipient = String(parameters.recipient || parameters.to || '').trim();
  const isOutboundAction = action === 'notification.send' || action === 'payment.create';
  const isUnknownExternal =
    recipient.length > 0 &&
    !allowedRecipients.includes(recipient) &&
    (recipient.includes('@') || /external|attacker|gmail|yahoo|proton|offshore/i.test(recipient));

  // 1. Credit card numbers (13-19 digits, optional dashes/spaces)
  const cardCandidates = serialized.match(/\b(?:\d[ -]*?){13,19}\b/g) || [];
  for (const candidate of cardCandidates) {
    const digits = candidate.replace(/\D/g, '');
    if (passesLuhn(digits)) {
      threats.push({
        category: 'DLP_EXFILTRATION',
        severity: 'CRITICAL',
        risk_contribution: 55,
        evidence: `Card pattern ****-****-****-${digits.slice(-4)}`,
        explanation: 'Payment card number pattern detected in outbound payload or parameters.',
        recommended_action: 'Block transmission immediately and redact PCI-DSS regulated numbers.',
      });
      break;
    }
  }

  // 2. API keys / secret tokens
  const secretMatch = serialized.match(
    /(as_live_[a-zA-Z0-9_]{16,}|sk_(?:live|test)_[a-zA-Z0-9_]{12,}|AIza[0-9A-Za-z\-_]{20,}|ghp_[a-zA-Z0-9]{20,}|Bearer\s+[A-Za-z0-9\-_.]{20,})/i
  );
  if (secretMatch) {
    threats.push({
      category: 'DLP_EXFILTRATION',
      severity: 'CRITICAL',
      risk_contribution: 60,
      evidence: `${secretMatch[0].slice(0, 10)}...[REDACTED]`,
      explanation: 'Secret token or API key pattern detected in action payload.',
      recommended_action: 'Block execution and rotate any exposed credential.',
    });
  }

  // 3. Personal identifiers (SSN-like / PAN-like)
  const ssnMatch = serialized.match(/\b\d{3}-\d{2}-\d{4}\b/);
  const panMatch = serialized.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
  if (ssnMatch || panMatch) {
    threats.push({
      category: 'DLP_EXFILTRATION',
      severity: 'HIGH',
      risk_contribution: 45,
      evidence: ssnMatch ? 'Government ID pattern (XXX-XX-XXXX)' : 'Tax ID pattern (XXXXX9999X)',
      explanation: 'Sensitive personal tax or national identifier detected inside action payload.',
      recommended_action: 'Block outbound disclosure of PII.',
    });
  }

  // 4. Email & phone exfiltration when sending externally
  const emailMatches = serialized.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phoneMatches = serialized.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || [];

  if (isOutboundAction && isUnknownExternal && (emailMatches.length > 0 || phoneMatches.length > 0 || /confidential|customer_list|ssn|salary|bank_account/i.test(serialized))) {
    threats.push({
      category: 'DLP_EXFILTRATION',
      severity: 'HIGH',
      risk_contribution: 45,
      evidence: `Outbound transfer to untrusted destination (${recipient}) containing ${
        emailMatches.length > 0 ? 'email PII' : phoneMatches.length > 0 ? 'phone PII' : 'confidential markers'
      }`,
      explanation: 'Sensitive contact or confidential records targeted at an unauthorized external destination.',
      recommended_action: 'Block outbound notification/transfer and notify security operations.',
    });
  }

  return threats;
}
