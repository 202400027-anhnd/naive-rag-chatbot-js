import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getChatModel } from "./lib/rag/model";
import { searchLegalRagTool, searchLegalWebTool } from "./tools";
import {
  rememberPreferenceTool,
  recallPreferenceTool,
  getMemoryCheckpointer,
} from "./memory";

export const LEGAL_SYSTEM_PROMPT = `Bạn là Trợ lý Pháp luật Việt Nam thông minh, chuẩn xác, trung thực và tận tâm.

Nhiệm vụ của bạn là giải đáp thắc mắc, tư vấn quy định pháp luật dựa trên các nguồn căn cứ có thật.

BỐN QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ):
1. ƯU TIÊN KHO NỘI BỘ (RAG): Luôn ưu tiên dùng công cụ 'search_legal_rag' khi người dùng hỏi các quy định pháp luật chung (như Luật Dân sự, hợp đồng, thừa kế, tài sản, quyền nhân thân) đã có trong cơ sở dữ liệu nội bộ.
2. TRA CỨU WEB CHÍNH THỨC: Sử dụng công cụ 'search_legal_web' khi câu hỏi liên quan đến:
   - Các văn bản quy phạm pháp luật mới ban hành, nghị định, thông tư chuyên ngành.
   - Kiểm tra hiệu lực hiện hành hoặc các quy định chưa có trong kho nội bộ.
   - Yêu cầu cung cấp đường dẫn chính thức (vbpl.vn, vanban.chinhphu.vn, congbao.chinhphu.vn, thuvienphapluat.vn).
3. TRÍCH DẪN NGUỒN CĂN CỨ CÓ THẬT: Luôn nêu rõ tên văn bản (Luật / Bộ luật / Nghị định), số hiệu, năm ban hành, Điều, Khoản cụ thể nếu có trong kết quả tìm kiếm. Tuyệt đối không tự suy diễn hoặc bịa đặt điều luật không có trong kết quả tìm kiếm.
4. THỪA NHẬN KHI THIẾU CĂN CỨ: Nếu cả kho nội bộ và tìm kiếm web đều không có đủ thông tin hoặc kết quả trả về không liên quan, hãy thẳng thắn thông báo: "Tài liệu hiện có chưa đủ căn cứ pháp lý để khẳng định chính xác vấn đề này", tuyệt đối không tự bịa đặt câu trả lời.

QUY TẮC BỘ NHỚ VÀ SỞ THÍCH:
- Khi người dùng yêu cầu ghi nhớ sở thích hoặc phong cách trả lời (ví dụ: "hãy trả lời ngắn gọn", "tôi thích phong cách trang trọng"), hãy dùng công cụ 'remember_preference'.
- Bạn có thể gọi 'recall_preference' để đọc lại sở thích của người dùng và điều chỉnh văn phong cho phù hợp.
- Tuyệt đối không lưu các thông tin nhạy cảm (CCCD, SĐT, Email, Mật khẩu) vào bộ nhớ sở thích.
`;

export type CreateLegalAgentOptions = {
  llm?: BaseChatModel;
  tools?: any[];
  checkpointer?: any;
  systemPrompt?: string;
};

/**
 * Creates and returns the legal ReAct Agent.
 */
export function createLegalAgent(options?: CreateLegalAgentOptions) {
  const model = options?.llm ?? getChatModel({ temperature: 0 });
  const tools = options?.tools ?? [
    searchLegalRagTool,
    searchLegalWebTool,
    rememberPreferenceTool,
    recallPreferenceTool,
  ];
  const checkpointSaver = options?.checkpointer ?? getMemoryCheckpointer();
  const prompt = options?.systemPrompt ?? LEGAL_SYSTEM_PROMPT;

  return createReactAgent({
    llm: model,
    tools,
    checkpointSaver,
    prompt,
  });
}

// Singleton instance for route handlers
let globalAgentInstance: ReturnType<typeof createLegalAgent> | null = null;

export function getLegalAgent(): ReturnType<typeof createLegalAgent> {
  if (!globalAgentInstance) {
    globalAgentInstance = createLegalAgent();
  }
  return globalAgentInstance;
}
