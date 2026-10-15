/**
 * Internal types for Naive RAG subsystem.
 */

export type RawDocumentChunk = {
  id: number;
  document: string;
  content: string;
};

export type IndexedDocument = RawDocumentChunk & {
  vector: number[];
};

export type RetrievalResult = IndexedDocument & {
  score: number;
};

export type SourceReference = {
  document: string;
  chunk: number;
  score: number;
  content: string;
};

export type RAGResponse = {
  answer: string;
  sources: SourceReference[];
  blockedByGuardrail?: boolean;
};
