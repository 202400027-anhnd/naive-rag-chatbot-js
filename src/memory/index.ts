import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { PII_PATTERNS } from "../lib/rag/blackList";

export const DEFAULT_USER_ID = "default_user";

// In-Memory store for long-term user preferences: Map<userId, Map<key, value>>
const userPreferencesStore = new Map<string, Map<string, string>>();

// Global short-term memory checkpointer for LangGraph
let globalCheckpointer: MemorySaver | null = null;

/**
 * Returns a singleton instance of LangGraph MemorySaver for short-term session state.
 */
export function getMemoryCheckpointer(): MemorySaver {
  if (!globalCheckpointer) {
    globalCheckpointer = new MemorySaver();
  }
  return globalCheckpointer;
}

/**
 * Creates a fresh MemorySaver instance (useful for testing or isolating sessions).
 */
export function createMemoryCheckpointer(): MemorySaver {
  return new MemorySaver();
}

/**
 * Generates a new unique thread ID for a fresh conversation session (/new).
 */
export function createNewThreadId(): string {
  return `thread_${randomUUID().slice(0, 8)}`;
}

/**
 * Checks if input contains sensitive PII (CCCD, Phone, Email, Credit card, Password).
 */
export function containsSensitiveData(text: string): boolean {
  if (PII_PATTERNS.email && PII_PATTERNS.email.test(text)) return true;
  if (PII_PATTERNS.phone && PII_PATTERNS.phone.test(text)) return true;
  if (PII_PATTERNS.idCard && PII_PATTERNS.idCard.test(text)) return true;
  if (PII_PATTERNS.creditCard && PII_PATTERNS.creditCard.test(text)) return true;

  const lower = text.toLowerCase();
  const sensitiveKeywords = [
    "mật khẩu",
    "password",
    "passcode",
    "cvv",
    "mã pin",
    "số tài khoản",
  ];

  return sensitiveKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Programmatic helper to set a user preference.
 */
export function setUserPreference(
  key: string,
  value: string,
  userId: string = DEFAULT_USER_ID
): { success: boolean; message: string } {
  const combined = `${key} ${value}`;

  if (containsSensitiveData(combined)) {
    return {
      success: false,
      message:
        "Cảnh báo an toàn: Không được lưu thông tin nhạy cảm (CCCD, SĐT, Email, Mật khẩu, Thẻ tín dụng) vào bộ nhớ sở thích.",
    };
  }

  if (!userPreferencesStore.has(userId)) {
    userPreferencesStore.set(userId, new Map<string, string>());
  }

  const userPrefs = userPreferencesStore.get(userId)!;
  userPrefs.set(key.trim().toLowerCase(), value.trim());

  return {
    success: true,
    message: `Đã ghi nhớ sở thích [${key.trim()}]: "${value.trim()}".`,
  };
}

/**
 * Programmatic helper to get all preferences for a user.
 */
export function getUserPreferences(
  userId: string = DEFAULT_USER_ID
): Record<string, string> {
  const userPrefs = userPreferencesStore.get(userId);
  if (!userPrefs) {
    return {};
  }
  return Object.fromEntries(userPrefs.entries());
}

/**
 * Programmatic helper to clear preferences for testing or reset.
 */
export function clearUserPreferences(userId?: string): void {
  if (userId) {
    userPreferencesStore.delete(userId);
  } else {
    userPreferencesStore.clear();
  }
}

/**
 * Core function for remembering preference.
 */
export async function rememberPreference(
  key: string,
  value: string,
  userId: string = DEFAULT_USER_ID
): Promise<{ success: boolean; message: string }> {
  console.log("[TOOL] remember");
  return setUserPreference(key, value, userId);
}

/**
 * Core function for recalling preference.
 */
export async function recallPreference(
  key?: string,
  userId: string = DEFAULT_USER_ID
): Promise<{ preferences: Record<string, string>; message: string }> {
  console.log("[TOOL] recall");
  const allPrefs = getUserPreferences(userId);

  if (key) {
    const normalizedKey = key.trim().toLowerCase();
    const val = allPrefs[normalizedKey];
    if (val !== undefined) {
      return {
        preferences: { [normalizedKey]: val },
        message: `Sở thích [${key}]: "${val}".`,
      };
    }
    return {
      preferences: {},
      message: `Chưa có thông tin sở thích nào được lưu cho khóa '${key}'.`,
    };
  }

  const count = Object.keys(allPrefs).length;
  return {
    preferences: allPrefs,
    message:
      count > 0
        ? `Đã tìm thấy ${count} sở thích của người dùng: ${JSON.stringify(allPrefs)}`
        : "Người dùng chưa có sở thích nào được lưu.",
  };
}

/** Aliases matching INTEGRATION.md */
export const remember_preference = rememberPreference;
export const recall_preference = recallPreference;

/**
 * LangChain Tool: remember_preference
 */
export const rememberPreferenceTool = tool(
  async ({
    key,
    value,
    userId,
  }: {
    key: string;
    value: string;
    userId?: string;
  }) => {
    const result = await rememberPreference(key, value, userId || DEFAULT_USER_ID);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "remember_preference",
    description:
      "Ghi nhớ sở thích phong cách trả lời hoặc thói quen của người dùng (ví dụ: trả lời ngắn gọn, nêu điều khoản trước, văn phong súc tích). Tuyệt đối không lưu dữ liệu định danh nhạy cảm (CCCD, SĐT, Email, Mật khẩu).",
    schema: z.object({
      key: z
        .string()
        .describe("Tên loại sở thích (ví dụ: style, do_dai, cach_xung_ho)"),
      value: z
        .string()
        .describe("Nội dung sở thích (ví dụ: 'ngắn gọn', 'nêu căn cứ trước')"),
      userId: z
        .string()
        .optional()
        .describe("ID người dùng (mặc định là 'default_user')"),
    }),
  }
);

/**
 * LangChain Tool: recall_preference
 */
export const recallPreferenceTool = tool(
  async ({ key, userId }: { key?: string; userId?: string }) => {
    const result = await recallPreference(key, userId || DEFAULT_USER_ID);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "recall_preference",
    description:
      "Đọc lại các sở thích hoặc phong cách trả lời đã lưu của người dùng để tùy chỉnh câu trả lời cho phù hợp.",
    schema: z.object({
      key: z
        .string()
        .optional()
        .describe("Tên sở thích cần tìm (bỏ trống nếu muốn xem toàn bộ)"),
      userId: z
        .string()
        .optional()
        .describe("ID người dùng (mặc định là 'default_user')"),
    }),
  }
);
