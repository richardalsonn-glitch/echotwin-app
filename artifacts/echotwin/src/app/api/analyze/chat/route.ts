import { NextRequest, NextResponse } from "next/server";
import { analyzeChat } from "@/lib/ai/services";
import type { CachedChatMessage } from "@/lib/ai/analysis-pipeline";
import { getAiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

type AnalyzeChatBody = {
  messages?: unknown;
  target_name?: unknown;
  requester_name?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as AnalyzeChatBody;
    const messages = parseMessages(body.messages);
    const targetName = typeof body.target_name === "string" ? body.target_name.trim() : "";
    const requesterName =
      typeof body.requester_name === "string" ? body.requester_name.trim() : "Kullanici";

    if (!targetName || messages.length === 0) {
      return NextResponse.json(
        { error: "messages ve target_name gerekli" },
        { status: 400 }
      );
    }

    const analysis = await analyzeChat({
      messages,
      targetName,
      requesterName,
    });

    return NextResponse.json({ analysis, provider: "gemini" });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    return NextResponse.json(
      { error: aiError.message, code: aiError.code },
      { status: aiError.status }
    );
  }
}

function parseMessages(value: unknown): CachedChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CachedChatMessage | null => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      const sender = typeof record.sender === "string" ? record.sender : "";
      const content = typeof record.content === "string" ? record.content : "";
      if (!sender || !content) return null;
      return {
        sender,
        content,
        has_question:
          typeof record.has_question === "boolean"
            ? record.has_question
            : content.includes("?"),
        message_length:
          typeof record.message_length === "number" ? record.message_length : content.length,
      };
    })
    .filter((message): message is CachedChatMessage => message !== null);
}
