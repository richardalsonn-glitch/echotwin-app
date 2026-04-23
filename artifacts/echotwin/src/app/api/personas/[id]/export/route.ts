import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ExportMessage = {
  role: "user" | "assistant";
  content: string;
  message_type: string | null;
  created_at: string;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("id, display_name, target_name, requester_name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (personaError || !persona) {
    return NextResponse.json({ error: "Persona bulunamadi" }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("role, content, message_type, created_at")
    .eq("persona_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: "Sohbet okunamadi" }, { status: 500 });
  }

  const fileName = safeFileName(`${persona.display_name}-sohbet.txt`);
  const body = buildTxtExport({
    displayName: persona.display_name,
    targetName: persona.target_name,
    requesterName: persona.requester_name,
    messages: (messages ?? []) as ExportMessage[],
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildTxtExport(params: {
  displayName: string;
  targetName: string;
  requesterName: string;
  messages: ExportMessage[];
}): string {
  const lines = [
    `Profil: ${params.displayName}`,
    `Klonlanan kisi: ${params.targetName}`,
    `Kullanici: ${params.requesterName}`,
    `Disa aktarma: ${new Date().toISOString()}`,
    "",
    "Sohbet",
    "------",
  ];

  for (const message of params.messages) {
    const sender = message.role === "user" ? params.requesterName : params.targetName;
    const type = message.message_type && message.message_type !== "text" ? ` [${message.message_type}]` : "";
    lines.push(`[${formatDate(message.created_at)}] ${sender}${type}: ${message.content}`);
  }

  if (params.messages.length === 0) {
    lines.push("Henuz sohbet mesaji yok.");
  }

  return `${lines.join("\n")}\n`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeFileName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLocaleLowerCase("tr-TR");
}
