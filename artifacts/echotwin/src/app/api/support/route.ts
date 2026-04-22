import { NextRequest, NextResponse } from "next/server";
import { isLanguage, translate, type Language } from "@/lib/i18n";

export const runtime = "nodejs";

const MAX_SUPPORT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const SUPPORT_CATEGORIES = new Set([
  "account",
  "billing",
  "chat",
  "technical",
]);

type SupportAttachment = {
  name: string;
  type: string;
  size: number;
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const language = getLanguage(formData.get("language"));
  const category = getStringValue(formData.get("category"));
  const subject = getStringValue(formData.get("subject"));
  const description = getStringValue(formData.get("description"));
  const attachment = formData.get("attachment");

  if (!SUPPORT_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: translate(language, "support.needTopic") },
      { status: 400 }
    );
  }

  if (subject.length < 3) {
    return NextResponse.json(
      { error: translate(language, "support.needSubject") },
      { status: 400 }
    );
  }

  if (description.length < 10) {
    return NextResponse.json(
      { error: translate(language, "support.needDescription") },
      { status: 400 }
    );
  }

  const attachmentInfo = getSupportAttachment(attachment);
  if (attachmentInfo && attachmentInfo.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: translate(language, "support.fileTooLarge") },
      { status: 413 }
    );
  }

  const ticketId = `SUP-${Date.now().toString(36).toUpperCase()}`;

  console.info("[support] ticket created", {
    ticketId,
    category,
    language,
    subject,
    descriptionLength: description.length,
    attachment: attachmentInfo,
  });

  return NextResponse.json({
    ok: true,
    ticketId,
  });
}

function getStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function getLanguage(value: FormDataEntryValue | null): Language {
  return isLanguage(value) ? value : "tr";
}

function getSupportAttachment(
  value: FormDataEntryValue | null
): SupportAttachment | null {
  if (!value || typeof value === "string" || value.size < 1) return null;

  return {
    name: value.name || "attachment",
    type: value.type || "application/octet-stream",
    size: value.size,
  };
}

