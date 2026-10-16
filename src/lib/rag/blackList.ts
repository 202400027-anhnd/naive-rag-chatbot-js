export const PII_PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
  phone: /(?:\+84|0)[35789][0-9]{8}\b/g,
  idCard: /\b\d{12}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
};

export const INJECTION_KEYWORDS: string[] = [
  "ignore previous instructions",
  "bỏ qua các chỉ dẫn trước",
  "bỏ qua chỉ dẫn",
  "system prompt",
  "you are now in jailbreak mode",
  "reveal your instructions",
];
