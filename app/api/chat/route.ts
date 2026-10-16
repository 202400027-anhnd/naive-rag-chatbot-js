import { NextResponse, type NextRequest } from "next/server";
import { getLegalAgent } from "@/agent";
import { createNewThreadId, DEFAULT_USER_ID, getMemoryCheckpointer } from "@/memory";
import { validateUserInput } from "@/guardrails";
import type { Evidence, TurnUsage } from "@/contracts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, threadId, userId } = body;

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập câu hỏi pháp luật." },
        { status: 400 }
      );
    }

    const trimmedQuestion = question.trim();

    // 1. Guardrail Validation (Prompt Injection check)
    const validation = validateUserInput(trimmedQuestion);
    if (!validation.allowed) {
      return NextResponse.json({
        answer:
          validation.reason ||
          "Yêu cầu vi phạm chính sách an toàn thông tin của hệ thống.",
        evidence: [],
        toolsUsed: [],
        blockedByGuardrail: true,
        threadId: threadId || createNewThreadId(),
      });
    }

    const activeThreadId = threadId && String(threadId).trim() ? String(threadId).trim() : createNewThreadId();
    const activeUserId = userId && String(userId).trim() ? String(userId).trim() : DEFAULT_USER_ID;

    // 2. Invoke ReAct Agent with Session Checkpointer
    const agent = getLegalAgent();
    const response = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: trimmedQuestion,
          },
        ],
      },
      {
        configurable: {
          thread_id: activeThreadId,
          userId: activeUserId,
        },
      }
    );

    const messages = (response.messages || []) as any[];

    // 3. Extract final answer from the last assistant message
    const lastMsg = messages[messages.length - 1];
    let rawAnswer = "";

    if (lastMsg) {
      if (typeof lastMsg.content === "string") {
        rawAnswer = lastMsg.content;
      } else if (Array.isArray(lastMsg.content)) {
        rawAnswer = lastMsg.content
          .map((item: any) =>
            typeof item === "string" ? item : item.text || ""
          )
          .join("\n");
      }
    }

    if (!rawAnswer) {
      rawAnswer = "Không nhận được phản hồi từ hệ thống trợ lý.";
    }

    // 4. Collect actual tools called and evidence returned
    const toolsUsed: string[] = [];
    const evidenceList: Evidence[] = [];

    for (const msg of messages) {
      // Check tool_calls in AI messages
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.name && !toolsUsed.includes(tc.name)) {
            toolsUsed.push(tc.name);
          }
        }
      }

      // Check tool messages
      if (msg.name && !toolsUsed.includes(msg.name)) {
        toolsUsed.push(msg.name);
      }

      // Parse JSON from ToolMessage content to extract evidence
      if (typeof msg.content === "string") {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed && Array.isArray(parsed.evidence)) {
            for (const ev of parsed.evidence) {
              if (
                !evidenceList.some(
                  (existing) => existing.url === ev.url && existing.id === ev.id
                )
              ) {
                evidenceList.push(ev);
              }
            }
          }
        } catch {
          // Non-JSON tool message, ignore
        }
      }
    }

    // 5. Calculate token usage for this turn
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    if (lastMsg?.usage_metadata) {
      inputTokens = lastMsg.usage_metadata.input_tokens || 0;
      outputTokens = lastMsg.usage_metadata.output_tokens || 0;
      totalTokens =
        lastMsg.usage_metadata.total_tokens || inputTokens + outputTokens;
    } else {
      inputTokens = Math.ceil(trimmedQuestion.length / 4);
      outputTokens = Math.ceil(rawAnswer.length / 4);
      totalTokens = inputTokens + outputTokens;
    }

    const turnUsage: TurnUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      missingUsageCount: lastMsg?.usage_metadata ? 0 : 1,
    };

    return NextResponse.json({
      answer: rawAnswer,
      evidence: evidenceList,
      toolsUsed,
      threadId: activeThreadId,
      turnUsage,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Không thể xử lý câu hỏi lúc này. Vui lòng kiểm tra API key trong file .env và thử lại.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Lấy lại lịch sử tin nhắn của một thread cũ từ Checkpointer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: "Thiếu tham số threadId." },
        { status: 400 }
      );
    }

    const checkpointer = getMemoryCheckpointer();
    const tuple = await checkpointer.getTuple({
      configurable: { thread_id: threadId },
    });

    if (!tuple || !tuple.checkpoint) {
      return NextResponse.json({
        threadId,
        messages: [],
      });
    }

    const rawMessages = (tuple.checkpoint.channel_values as any)?.messages || [];
    const formattedMessages = [];

    for (const msg of rawMessages) {
      const type = msg._getType ? msg._getType() : msg.role;
      const content =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
          ? msg.content.map((c: any) => c.text || "").join("\n")
          : "";

      if (type === "human" || type === "user") {
        formattedMessages.push({
          role: "user",
          content,
        });
      } else if ((type === "ai" || type === "assistant") && content.trim()) {
        formattedMessages.push({
          role: "assistant",
          content,
        });
      }
    }

    return NextResponse.json({
      threadId,
      messages: formattedMessages,
    });
  } catch (error: any) {
    console.error("GET Chat History error:", error);
    return NextResponse.json(
      { error: "Không thể lấy lịch sử cuộc trò chuyện." },
      { status: 500 }
    );
  }
}

