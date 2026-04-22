import { NextRequest, NextResponse } from "next/server";

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
  const category = getStringValue(formData.get("category"));
  const subject = getStringValue(formData.get("subject"));
  const description = getStringValue(formData.get("description"));
  const attachment = formData.get("attachment");

  if (!SUPPORT_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: "Lütfen destek konusunu seç." },
      { status: 400 }
    );
  }

  if (subject.length < 3) {
    return NextResponse.json(
      { error: "Konu başlığını biraz daha net yaz." },
      { status: 400 }
    );
  }

  if (description.length < 10) {
    return NextResponse.json(
      { error: "Açıklama kısmını biraz daha detaylandır." },
      { status: 400 }
    );
  }

  const attachmentInfo = getSupportAttachment(attachment);
  if (attachmentInfo && attachmentInfo.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: "Ek dosya 20 MB'dan büyük olamaz." },
      { status: 413 }
    );
  }

  const ticketId = `SUP-${Date.now().toString(36).toUpperCase()}`;

  console.info("[support] ticket created", {
    ticketId,
    category,
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

function getSupportAttachment(
  value: FormDataEntryValue | null
): SupportAttachment | null {
  if (!value || typeof value === "string" || value.size < 1) return null;

  return {
    name: value.name || "ek-dosya",
    type: value.type || "application/octet-stream",
    size: value.size,
  };
}
