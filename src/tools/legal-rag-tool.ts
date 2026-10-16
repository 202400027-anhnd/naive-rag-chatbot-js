import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { retrieve } from "../lib/rag/retrieval";
import type { RetrievalResult } from "../lib/rag/types";
import type { Evidence, SearchResult } from "../contracts";
import { extractLegalMetadata } from "./utils";

export const DEFAULT_RAG_MIN_SCORE = 0.65;
export const DEFAULT_RAG_TOP_K = 5;

export type SearchLegalRagOptions = {
  topK?: number;
  minScore?: number;
  retriever?: (query: string, topK?: number) => Promise<RetrievalResult[]>;
};

/**
 * Core search function for internal legal documents (Naive RAG adapter).
 * Fulfills contract: search_legal_rag({ query }) -> SearchResult
 */
export async function searchLegalRag(
  query: string,
  options?: SearchLegalRagOptions
): Promise<SearchResult> {
  console.log("[TOOL] rag");

  try {
    const retrieverFn = options?.retriever ?? retrieve;
    const topK = options?.topK ?? DEFAULT_RAG_TOP_K;
    const minScore = options?.minScore ?? DEFAULT_RAG_MIN_SCORE;

    const docs = await retrieverFn(query, topK);

    if (!docs || docs.length === 0) {
      return {
        query,
        evidence: [],
        insufficient_evidence: true,
      };
    }

    const relevantDocs = docs.filter((doc) => doc.score >= minScore);

    if (relevantDocs.length === 0) {
      return {
        query,
        evidence: [],
        insufficient_evidence: true,
      };
    }

    const evidence: Evidence[] = relevantDocs.map((doc) => {
      const meta = extractLegalMetadata(doc.content, doc.document);
      return {
        id: `rag-${doc.document}-${doc.id}`,
        origin: "rag",
        title: doc.document,
        url: `local://documents/${doc.document}#chunk-${doc.id}`,
        snippet: doc.content.trim(),
        lawNumber: meta.lawNumber,
        article: meta.article,
        clause: meta.clause,
        fetchedAt: new Date().toISOString(),
        verification: "source_checked",
      };
    });

    return {
      query,
      evidence,
      insufficient_evidence: false,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      query,
      evidence: [],
      error: errorMessage,
      insufficient_evidence: true,
    };
  }
}

/** Alias matching INTEGRATION.md interface */
export const search_legal_rag = searchLegalRag;

/**
 * Creates a LangChain Tool for ReAct Agent with optional custom retriever options.
 */
export function createSearchLegalRagTool(options?: SearchLegalRagOptions) {
  return tool(
    async ({ query }: { query: string }) => {
      const result = await searchLegalRag(query, options);
      return JSON.stringify(result, null, 2);
    },
    {
      name: "search_legal_rag",
      description:
        "Tra cứu cơ sở dữ liệu pháp luật nội bộ (Naive RAG). Luôn ưu tiên dùng tool này đầu tiên khi người dùng hỏi các quy định, điều khoản pháp luật chung đã có trong kho dữ liệu.",
      schema: z.object({
        query: z
          .string()
          .describe("Nội dung câu hỏi hoặc từ khóa pháp lý cần tra cứu trong kho nội bộ"),
      }),
    }
  );
}

/**
 * Default LangChain Tool for ReAct Agent
 */
export const searchLegalRagTool = createSearchLegalRagTool();
