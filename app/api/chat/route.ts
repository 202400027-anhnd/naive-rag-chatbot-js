import { NextResponse, type NextRequest } from "next/server";
import { askRAG } from "@/lib/rag/synthesis";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập câu hỏi." },
        { status: 400 }
      );
    }

    const result = await askRAG(question.trim());

    return NextResponse.json({
      answer: result.answer,
      sources: result.sources,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Không thể xử lý câu hỏi. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
