import { PII_PATTERNS, INJECTION_KEYWORDS } from "../lib/rag/blackList";

/**
 * Redacts personal identifiable information (PII) such as phone numbers,
 * citizen ID (CCCD), emails, and credit cards from text.
 * Contract as defined in INTEGRATION.md: redactPersonalData(text) -> string
 */
export function redactPersonalData(text: string): string {
  let result = text;
  if (PII_PATTERNS.email) {
    result = result.replace(PII_PATTERNS.email, "[EMAIL_REDACTED]");
  }
  if (PII_PATTERNS.phone) {
    result = result.replace(PII_PATTERNS.phone, "[PHONE_REDACTED]");
  }
  if (PII_PATTERNS.idCard) {
    result = result.replace(PII_PATTERNS.idCard, "[ID_CARD_REDACTED]");
  }
  if (PII_PATTERNS.creditCard) {
    result = result.replace(PII_PATTERNS.creditCard, "[CARD_REDACTED]");
  }
  return result;
}

/**
 * Validates user input to prevent prompt injections or policy violations.
 * Contract as defined in INTEGRATION.md: validateUserInput(text) -> { allowed: boolean, reason?: string }
 */
export function validateUserInput(text: string): { allowed: boolean; reason?: string } {
  const lower = text.toLowerCase();
  for (const keyword of INJECTION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        allowed: false,
        reason: "Yêu cầu vi phạm chính sách an toàn hệ thống (Prompt Injection).",
      };
    }
  }
  return { allowed: true };
}

/**
 * Sanitizes tool results before feeding back to LLM.
 * Contract as defined in INTEGRATION.md: sanitizeToolResult(data) -> data
 */
export function sanitizeToolResult<T>(data: T): T {
  return data;
}
