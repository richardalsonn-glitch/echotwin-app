import type { VoiceProfileMetadata } from "@/types/persona";
import { synthesizeSpeech, type ElevenLabsSpeechResult } from "./elevenlabs";

export type PersonaVoiceRequest = {
  text: string;
  personaName: string;
  voiceSampleUrl: string | null;
  voiceProfileMetadata: VoiceProfileMetadata | null;
};

export type PersonaVoiceResult = ElevenLabsSpeechResult & {
  spokenText: string;
  cloned: boolean;
  profileSource: "elevenlabs-clone" | "elevenlabs-default";
};

export async function generatePersonaVoiceMessage(
  request: PersonaVoiceRequest
): Promise<PersonaVoiceResult> {
  const spokenText = prepareVoiceMessageText(request.text);
  const voiceId =
    request.voiceProfileMetadata?.elevenlabs_voice_id ??
    process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim();

  if (!voiceId) {
    throw new Error("ElevenLabs voice id is missing");
  }

  const tts = await synthesizeSpeech({ text: spokenText, voiceId });

  return {
    ...tts,
    spokenText,
    cloned: Boolean(request.voiceProfileMetadata?.elevenlabs_voice_id),
    profileSource: request.voiceProfileMetadata?.elevenlabs_voice_id
      ? "elevenlabs-clone"
      : "elevenlabs-default",
  };
}

export function prepareVoiceMessageText(text: string): string {
  const compact = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) return "Bunu sesli soylemek istedim.";
  if (compact.length <= 260) return compact;

  const firstSentence = compact.match(/^.{40,260}?[.!?](\s|$)/)?.[0]?.trim();
  if (firstSentence) return firstSentence;

  return `${compact.slice(0, 257).trim()}...`;
}
