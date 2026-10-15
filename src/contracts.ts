/**
 * Shared Contracts as defined in INTEGRATION.md
 * Used for inter-module integration between Dev 1 and Dev 2.
 */

export type Evidence = {
  id: string;
  origin: "rag" | "web";
  title: string;
  url: string;
  snippet: string;
  lawNumber?: string;
  article?: string;
  clause?: string;
  fetchedAt?: string;
  verification?: "unverified" | "source_checked";
};

export type SearchResult = {
  query: string;
  evidence: Evidence[];
  error?: string;
  insufficient_evidence?: boolean;
};

export type AnswerReviewInput = {
  question: string;
  answer: string;
  evidence: Evidence[];
};

export type AnswerReview = {
  safeAnswer: string;
  citedSources: Evidence[];
  warnings: string[];
  insufficientEvidence: boolean;
};

export type TurnUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  missingUsageCount: number;
};

export type ValidationResult = {
  allowed: boolean;
  reason?: string;
};
