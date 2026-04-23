import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Persona } from "@/types/persona";
import type { SubscriptionTier } from "@/types/subscription";
import {
  canUsePersonaVoice,
  createVoiceProfileMetadata,
  createVoiceSampleStoragePath,
  validateVoiceSampleFile,
  VOICE_SAMPLE_BUCKET,
} from "@/lib/voice/profile";
import { createVoiceClone } from "@/lib/voice/elevenlabs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = toSubscriptionTier(profile?.subscription_tier);
  if (!canUsePersonaVoice(tier)) {
    return NextResponse.json(
      { error: "Ses profili yalnizca Full planda kullanilabilir", upgrade_required: true },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const personaId = formData.get("persona_id");
  const audio = formData.get("audio");

  if (typeof personaId !== "string" || !personaId.trim()) {
    return NextResponse.json({ error: "persona_id gerekli" }, { status: 400 });
  }

  if (!isUploadedFile(audio)) {
    return NextResponse.json(
      { error: "Ses ornegi okunamadi, tekrar dene" },
      { status: 400 }
    );
  }

  const validation = validateVoiceSampleFile(audio);
  if (!validation.ok) {
    console.warn("[voice-profile] rejected upload", {
      reason: validation.debugMessage,
      type: audio.type,
      size: audio.size,
    });
    return NextResponse.json({ error: validation.userMessage }, { status: validation.status });
  }

  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .eq("user_id", user.id)
    .single();

  if (personaError || !persona) {
    return NextResponse.json({ error: "Persona bulunamadi" }, { status: 404 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("personas")
    .update({
      voice_profile_status: "processing",
      voice_enabled: false,
      updated_at: now,
    })
    .eq("id", personaId)
    .eq("user_id", user.id);

  try {
    const storagePath = createVoiceSampleStoragePath(user.id, personaId, audio);
    const { error: uploadError } = await supabase.storage
      .from(VOICE_SAMPLE_BUCKET)
      .upload(storagePath, audio, {
        upsert: true,
        contentType: audio.type || "audio/mpeg",
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage
      .from(VOICE_SAMPLE_BUCKET)
      .getPublicUrl(storagePath);

    const clone = await createVoiceClone({
      name: `${persona.display_name ?? persona.target_name} - ${personaId}`,
      audioSample: audio,
      description: "BendekiSen persona voice profile",
    });
    const metadata = {
      ...createVoiceProfileMetadata(audio, storagePath, now),
      provider: "elevenlabs" as const,
      elevenlabs_voice_id: clone.voiceId,
    };
    const { data: updatedPersona, error: updateError } = await supabase
      .from("personas")
      .update({
        voice_sample_url: urlData.publicUrl,
        voice_profile_status: "ready",
        voice_enabled: true,
        voice_profile_metadata: metadata,
        voice_message_sent: false,
        voice_message_sent_at: null,
        updated_at: now,
      })
      .eq("id", personaId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError || !updatedPersona) {
      throw new Error(updateError?.message ?? "Voice profile update failed");
    }

    return NextResponse.json({
      voice_profile: {
        status: "ready",
        enabled: true,
        metadata,
        persona: updatedPersona as Persona,
      },
    });
  } catch (error) {
    console.error("[voice-profile] failed", {
      persona_id: personaId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    await supabase
      .from("personas")
      .update({
        voice_profile_status: "failed",
        voice_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personaId)
      .eq("user_id", user.id);

    return NextResponse.json(
      { error: "Ses profili hazirlanamadi, daha sonra tekrar dene" },
      { status: 500 }
    );
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null;
}

function toSubscriptionTier(value: unknown): SubscriptionTier {
  return value === "basic" || value === "full" ? value : "free";
}
