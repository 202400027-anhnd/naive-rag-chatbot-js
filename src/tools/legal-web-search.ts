import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { Evidence, SearchResult } from "../contracts";
import { redactPersonalData } from "../guardrails";
import { extractLegalMetadata } from "./utils";

export const OFFICIAL_LEGAL_DOMAINS = [
  "vbpl.vn",
  "vanban.chinhphu.vn",
  "congbao.chinhphu.vn",
  "moj.gov.vn",
  "thuvienphapluat.vn",
];

export type SearchLegalWebOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  redactor?: (text: string) => string;
  maxResults?: number;
};

/**
 * Check if a URL belongs to one of the official legal portals.
 */
export function isOfficialLegalDomain(
  urlString: string,
  officialDomains = OFFICIAL_LEGAL_DOMAINS
): boolean {
  try {
    const parsed = new URL(urlString);
    return officialDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Searches the web for legal documents and regulations using Tavily API.
 * Fulfills contract: search_legal_web({ query }) -> SearchResult
 */
export async function searchLegalWeb(
  query: string,
  options?: SearchLegalWebOptions
): Promise<SearchResult> {
  console.log("[TOOL] web");

  const redactorFn = options?.redactor ?? redactPersonalData;
  const sanitizedQuery = redactorFn(query);

  const apiKey = options?.apiKey ?? process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      query: sanitizedQuery,
      evidence: [],
      error:
        "TAVILY_API_KEY chưa được cấu hình. Tính năng tra cứu web tạm thời không khả dụng.",
      insufficient_evidence: true,
    };
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const maxResults = options?.maxResults ?? 5;

  try {
    const response = await fetchFn("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: sanitizedQuery,
        search_depth: "basic",
        include_domains: OFFICIAL_LEGAL_DOMAINS,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        query: sanitizedQuery,
        evidence: [],
        error: `Lỗi kết nối Tavily API (${response.status}): ${errorText || response.statusText}`,
        insufficient_evidence: true,
      };
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
    };

    const rawResults = data.results ?? [];

    if (rawResults.length === 0) {
      return {
        query: sanitizedQuery,
        evidence: [],
        insufficient_evidence: true,
      };
    }

    const evidence: Evidence[] = rawResults.slice(0, maxResults).map((item, idx) => {
      const itemUrl = item.url ?? "";
      const isOfficial = isOfficialLegalDomain(itemUrl);
      const meta = extractLegalMetadata(
        `${item.title ?? ""} ${item.content ?? ""}`
      );

      return {
        id: `web-${idx + 1}`,
        origin: "web",
        title: item.title || "Văn bản pháp luật trực tuyến",
        url: itemUrl,
        snippet: (item.content ?? "").trim(),
        lawNumber: meta.lawNumber,
        article: meta.article,
        clause: meta.clause,
        fetchedAt: new Date().toISOString(),
        verification: isOfficial ? "source_checked" : "unverified",
      };
    });

    return {
      query: sanitizedQuery,
      evidence,
      insufficient_evidence: false,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      query: sanitizedQuery,
      evidence: [],
      error: `Lỗi tìm kiếm web: ${errorMessage}`,
      insufficient_evidence: true,
    };
  }
}

/** Alias matching INTEGRATION.md interface */
export const search_legal_web = searchLegalWeb;

/**
 * Creates a LangChain Tool for ReAct Agent with configurable search options.
 */
export function createSearchLegalWebTool(options?: SearchLegalWebOptions) {
  return tool(
    async ({ query }: { query: string }) => {
      const result = await searchLegalWeb(query, options);
      return JSON.stringify(result, null, 2);
    },
    {
      name: "search_legal_web",
      description:
        "Tra cứu văn bản pháp luật, nghị định, thông tư hoặc thông tin pháp luật mới trên internet từ các cổng thông tin chính thức (vbpl.vn, vanban.chinhphu.vn, congbao.chinhphu.vn, moj.gov.vn, thuvienphapluat.vn). Sử dụng khi thông tin chưa có trong tài liệu nội bộ hoặc cần tra cứu quy định mới.",
      schema: z.object({
        query: z
          .string()
          .describe("Từ khóa hoặc câu hỏi pháp lý cần tìm kiếm trên internet"),
      }),
    }
  );
}

/**
 * Default LangChain Tool for ReAct Agent
 */
export const searchLegalWebTool = createSearchLegalWebTool();
