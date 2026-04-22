import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hasEnoughTargetMessages,
  runResilientPersonaAnalysis,
  type AnalysisPipelineStatus,
  type CachedChatMessage,
} from "@/lib/ai/analysis-pipeline";
import { getAiErrorResponse } from "@/lib/ai/errors";

type AnalyzeRequestBody = {
  persona_id?: unknown;
};

type PersonaRecord = {
  id: string;
  user_id: string;
  export_id: string | null;
  target_name: string;
  requester_name: string;
  analysis: unknown;
};

type MessageCacheRecord = {
  messages: unknown;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AnalyzeRequestBody;
    const personaId = typeof body.persona_id === "string" ? body.persona_id : "";

    if (!personaId) {
      return NextResponse.json({ error: "persona_id gerekli" }, { status: 400 });
    }

    await updateAnalysisStatus(supabase, personaId, user.id, "queued");

    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .eq("user_id", user.id)
      .single<PersonaRecord>();

    if (personaError || !persona) {
      return NextResponse.json({ error: "Persona bulunamadi" }, { status: 404 });
    }

    if (isExistingAnalysis(persona.analysis)) {
      console.info(`[analysis] cache-hit persona=${personaId}`);
      await updateAnalysisStatus(supabase, personaId, user.id, "completed");
      return NextResponse.json({
        persona,
        analysis: persona.analysis,
        status: "completed",
        cached: true,
      });
    }

    const { data: cacheRecord, error: cacheError } = await supabase
      .from("chat_messages_cache")
      .select("messages")
      .eq("export_id", persona.export_id)
      .eq("user_id", user.id)
      .single<MessageCacheRecord>();

    if (cacheError || !cacheRecord) {
      await updateAnalysisStatus(supabase, personaId, user.id, "failed", "messages_missing");
      return NextResponse.json(
        { error: "Sohbet mesajlari bulunamadi. Lutfen tekrar yukle.", status: "failed" },
        { status: 404 }
      );
    }

    const messages = parseCachedMessages(cacheRecord.messages);

    if (!hasEnoughTargetMessages(messages, persona.target_name)) {
      await updateAnalysisStatus(supabase, personaId, user.id, "failed", "not_enough_messages");
      return NextResponse.json(
        {
          error: `${persona.target_name} adina yeterli mesaj bulunamadi. Daha uzun bir sohbet yukleyip tekrar dene.`,
          status: "failed",
        },
        { status: 400 }
      );
    }

    await updateAnalysisStatus(supabase, personaId, user.id, "processing");

    const result = await runResilientPersonaAnalysis({
      targetName: persona.target_name,
      requesterName: persona.requester_name,
      messages,
    });

    const updatePayload = {
      analysis: result.analysis,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedPersona, error: updateError } = await supabase
      .from("personas")
      .update(updatePayload)
      .eq("id", personaId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      await updateAnalysisStatus(supabase, personaId, user.id, "failed", "database_update_failed");
      return NextResponse.json({ error: "Analiz kaydedilemedi. Lutfen tekrar dene." }, { status: 500 });
    }

    await updateAnalysisStatus(
      supabase,
      personaId,
      user.id,
      result.status,
      undefined,
      {
        provider: result.provider,
        attemptCount: result.attempts.length,
        summaryCache: result.summaryCache,
      }
    );

    console.info(
      `[analysis] finished persona=${personaId} status=${result.status} durationMs=${Date.now() - startedAt}`
    );

    return NextResponse.json({
      persona: updatedPersona,
      analysis: result.analysis,
      status: result.status,
      provider: result.provider,
      model: result.model,
      used_basic_fallback: result.usedBasicFallback,
    });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    console.error("[analysis] failed", error);
    return NextResponse.json(
      {
        error: toUserAnalysisError(aiError.code),
        code: aiError.code,
        status: "failed",
      },
      { status: aiError.status }
    );
  }
}

function parseCachedMessages(value: unknown): CachedChatMessage[] {
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

function isExistingAnalysis(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

async function updateAnalysisStatus(
  supabase: SupabaseClient,
  personaId: string,
  userId: string,
  status: AnalysisPipelineStatus,
  errorCode?: string,
  metadata?: {
    provider?: string;
    attemptCount?: number;
    summaryCache?: unknown;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    analysis_status: status,
    analysis_error_code: errorCode ?? null,
    updated_at: new Date().toISOString(),
  };

  if (status === "processing" || status === "retrying") {
    updatePayload.analysis_attempt_count = metadata?.attemptCount ?? 0;
  }

  if (status === "completed" || status === "completed_basic") {
    updatePayload.analysis_provider = metadata?.provider ?? null;
    updatePayload.analysis_attempt_count = metadata?.attemptCount ?? 0;
    updatePayload.analysis_completed_at = new Date().toISOString();
    updatePayload.analysis_summary_cache = metadata?.summaryCache ?? null;
  }

  const { error } = await supabase
    .from("personas")
    .update(updatePayload)
    .eq("id", personaId)
    .eq("user_id", userId);

  if (!error) return;

  if (isMissingAnalysisStatusColumn(error.message)) {
    console.warn("[analysis] status columns missing; continuing without status persistence");
    return;
  }

  console.warn("[analysis] status update failed", error);
}

function isMissingAnalysisStatusColumn(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("analysis_status") || lower.includes("analysis_error_code");
}

function toUserAnalysisError(code: string): string {
  if (code === "ai_rate_limited") {
    return "Analiz su anda yogunluk nedeniyle gecikti. Lutfen biraz sonra tekrar dene.";
  }
  if (code === "ai_timeout" || code === "ai_provider_unavailable") {
    return "Gecici bir baglanti sorunu olustu. Analiz tamamlanamadi, yeniden deneyebilirsin.";
  }
  if (code === "ai_auth_failed" || code === "ai_config_missing") {
    return "Analiz servisi su anda hazir degil. Uygulama yoneticisinin AI ayarlarini kontrol etmesi gerekiyor.";
  }
  return "Analiz tamamlanamadi. Lutfen yeniden dene.";
}
