import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, Persona } from "@/types/persona";
import type { SubscriptionTier } from "@/types/subscription";
import { generatePersonaVoiceMessage } from "./clone";
import {
  canUsePersonaVoice,
  createVoiceMessageStoragePath,
  VOICE_MESSAGE_BUCKET,
} from "./profile";

export const VOICE_MESSAGE_TRIGGER_COUNT = 5;

export type StoredVoiceMessage = {
  message: ChatMessage;
  provider: string;
  model: string;
  cloned: boolean;
};

export function shouldQueuePersonaVoiceMessage(
  persona: Persona,
  tier: SubscriptionTier,
  nextMessageCount: number
): boolean {
  return (
    canUsePersonaVoice(tier) &&
    nextMessageCount >= VOICE_MESSAGE_TRIGGER_COUNT &&
    persona.voice_enabled === true &&
    persona.voice_profile_status === "ready" &&
    persona.voice_message_sent !== true &&
    Boolean(persona.voice_sample_url)
  );
}

export async function createAndStorePersonaVoiceMessage(params: {
  supabase: SupabaseClient;
  persona: Persona;
  userId: string;
  text: string;
}): Promise<StoredVoiceMessage> {
  const generated = await generatePersonaVoiceMessage({
    text: params.text,
    personaName: params.persona.display_name,
    voiceSampleUrl: params.persona.voice_sample_url,
    voiceProfileMetadata: params.persona.voice_profile_metadata,
  });

  const now = new Date().toISOString();
  const storagePath = createVoiceMessageStoragePath(
    params.userId,
    params.persona.id,
    generated.extension
  );

  const audioBlob = new Blob([generated.audio], { type: generated.contentType });
  const { error: uploadError } = await params.supabase.storage
    .from(VOICE_MESSAGE_BUCKET)
    .upload(storagePath, audioBlob, {
      upsert: false,
      contentType: generated.contentType,
    });

  if (uploadError) {
    throw new Error(`Voice message upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = params.supabase.storage
    .from(VOICE_MESSAGE_BUCKET)
    .getPublicUrl(storagePath);

  const { data: message, error: insertError } = await params.supabase
    .from("messages")
    .insert({
      persona_id: params.persona.id,
      user_id: params.userId,
      role: "assistant",
      content: generated.spokenText,
      message_type: "voice",
      audio_url: urlData.publicUrl,
      audio_duration_seconds: null,
      voice_provider: `${generated.provider}:${generated.model}:${generated.voice}`,
      created_at: now,
    })
    .select("*")
    .single();

  if (insertError || !message) {
    throw new Error(insertError?.message ?? "Voice message insert failed");
  }

  const { error: updateError } = await params.supabase
    .from("personas")
    .update({
      voice_message_sent: true,
      voice_message_sent_at: now,
      updated_at: now,
    })
    .eq("id", params.persona.id)
    .eq("user_id", params.userId);

  if (updateError) {
    throw new Error(`Voice sent marker update failed: ${updateError.message}`);
  }

  return {
    message: message as ChatMessage,
    provider: generated.provider,
    model: generated.model,
    cloned: generated.cloned,
  };
}
