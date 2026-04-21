import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAndStorePersonaVoiceMessage, shouldQueuePersonaVoiceMessage } from "@/lib/voice/message";
import type { Persona } from "@/types/persona";
import type { SubscriptionTier } from "@/types/subscription";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const payload = getObjectValue(body);
  const personaId = typeof payload.persona_id === "string" ? payload.persona_id : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  const messageCountUsed =
    typeof payload.message_count_used === "number" ? payload.message_count_used : 0;

  if (!personaId || !text.trim()) {
    return NextResponse.json({ skipped: true, reason: "missing_payload" });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = toSubscriptionTier(profile?.subscription_tier);
  if (tier !== "full") {
    return NextResponse.json({ skipped: true, reason: "tier_not_allowed" });
  }

  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .eq("user_id", user.id)
    .single();

  if (personaError || !persona) {
    return NextResponse.json({ skipped: true, reason: "persona_not_found" });
  }

  const typedPersona = persona as Persona;
  if (!shouldQueuePersonaVoiceMessage(typedPersona, tier, messageCountUsed)) {
    return NextResponse.json({ skipped: true, reason: "not_eligible" });
  }

  try {
    const result = await createAndStorePersonaVoiceMessage({
      supabase,
      persona: typedPersona,
      userId: user.id,
      text,
    });

    return NextResponse.json({
      skipped: false,
      message: result.message,
      provider: result.provider,
      model: result.model,
      cloned: result.cloned,
    });
  } catch (error) {
    console.error("[voice-message] fallback to text only", {
      persona_id: personaId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ skipped: true, reason: "generation_failed" });
  }
}

function getObjectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function toSubscriptionTier(value: unknown): SubscriptionTier {
  return value === "basic" || value === "full" ? value : "free";
}
