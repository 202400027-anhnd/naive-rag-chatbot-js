import { NextResponse } from "next/server";
import { askRAG } from "../../../src/lib/rag/synthesis.js";

export const runtime = "nodejs";

export async function POST(request) {
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
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Không thể xử lý câu hỏi. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
