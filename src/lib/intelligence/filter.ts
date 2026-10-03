export interface EmailMetadata {
  sender: string;
  subject: string;
  body: string;
}

const NOISE_SENDER_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /notifications?@/i,
  /alerts?@/i,
  /invoices?@/i,
  /receipts?@/i,
  /billing@/i,
  /newsletters?@/i,
  /donotreply@/i,
  /bounce@/i,
  /mailer-daemon@/i,
];

const NOISE_SUBJECT_PATTERNS = [
  /\breceipt\b/i,
  /\binvoice\b/i,
  /\bstatement\b/i,
  /\border confirmation\b/i,
  /\bpayment received\b/i,
  /\bsecurity alert\b/i,
  /\bpassword reset\b/i,
  /\bverify your email\b/i,
  /\bnewsletter\b/i,
  /\bweekly digest\b/i,
  /\bunsubscribe\b/i,
];

/**
 * Evaluates whether an incoming email is automated noise, receipts, or non-lead spam.
 * If true, the message is immediately dropped from memory without database persistence.
 */
export function isHeuristicNoise(email: EmailMetadata): boolean {
  if (!email.sender) return true;

  // 1. Check sender address
  for (const pattern of NOISE_SENDER_PATTERNS) {
    if (pattern.test(email.sender)) {
      return true;
    }
  }

  // 2. Check subject line
  if (email.subject) {
    for (const pattern of NOISE_SUBJECT_PATTERNS) {
      if (pattern.test(email.subject)) {
        return true;
      }
    }
  }

  return false;
}
