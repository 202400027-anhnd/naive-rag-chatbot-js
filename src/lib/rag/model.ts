import "dotenv/config";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export type ModelConfig = {
  modelName?: string;
  temperature?: number;
};

/**
 * Returns a configured Chat Model based on available environment variables.
 * Priority order:
 * 1. Google Gemini (GEMINI_API_KEY or GOOGLE_API_KEY)
 * 2. LiteLLM Proxy (LITELLM_API_KEY + LITELLM_BASE_URL)
 * 3. OpenAI Direct (OPENAI_API_KEY)
 */
export function getChatModel(config?: ModelConfig): BaseChatModel {
  const temperature = config?.temperature ?? 0;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // 1. Google Gemini (Native API)
  if (geminiKey) {
    const modelName =
      config?.modelName ||
      process.env.MODEL_NAME ||
      "gemini-1.5-flash";

    return new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: geminiKey,
      temperature,
    });
  }

  // 2. LiteLLM Proxy / Custom OpenAI Gateway
  if (process.env.LITELLM_API_KEY && process.env.LITELLM_BASE_URL) {
    const modelName =
      config?.modelName ||
      process.env.MODEL_NAME ||
      "gpt-4o-mini";

    return new ChatOpenAI({
      model: modelName,
      apiKey: process.env.LITELLM_API_KEY,
      configuration: {
        baseURL: process.env.LITELLM_BASE_URL,
      },
      temperature,
    });
  }

  // 3. OpenAI Direct
  if (process.env.OPENAI_API_KEY) {
    const modelName =
      config?.modelName ||
      process.env.MODEL_NAME ||
      "gpt-4o-mini";

    return new ChatOpenAI({
      model: modelName,
      apiKey: process.env.OPENAI_API_KEY,
      temperature,
    });
  }

  throw new Error(
    "Không tìm thấy cấu hình LLM hợp lệ trong file .env. Vui lòng cung cấp một trong các tùy chọn:\n" +
      "1. GEMINI_API_KEY (hoặc GOOGLE_API_KEY) để sử dụng Google Gemini (khuyến nghị).\n" +
      "2. LITELLM_API_KEY và LITELLM_BASE_URL để sử dụng LiteLLM proxy.\n" +
      "3. OPENAI_API_KEY để sử dụng OpenAI trực tiếp."
  );
}
