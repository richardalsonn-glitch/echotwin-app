import type { VoiceProfileMetadata } from "@/types/persona";
import { synthesizeSpeech, type VoiceTtsResult } from "./tts";

export type PersonaVoiceRequest = {
  text: string;
  personaName: string;
  voiceSampleUrl: string | null;
  voiceProfileMetadata: VoiceProfileMetadata | null;
};

export type PersonaVoiceResult = VoiceTtsResult & {
  spokenText: string;
  cloned: boolean;
  profileSource: "uploaded-sample-fallback-tts";
};

export async function generatePersonaVoiceMessage(
  request: PersonaVoiceRequest
): Promise<PersonaVoiceResult> {
  const spokenText = prepareVoiceMessageText(request.text);
  const tts = await synthesizeSpeech({
    text: spokenText,
    instructions: buildVoiceInstructions(request),
  });

  return {
    ...tts,
    spokenText,
    cloned: false,
    profileSource: "uploaded-sample-fallback-tts",
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

function buildVoiceInstructions(request: PersonaVoiceRequest): string {
  const durationHint = request.voiceProfileMetadata?.duration_estimate_seconds;
  const sampleHint = durationHint
    ? `Reference sample metadata is present, estimated ${durationHint} seconds.`
    : "Reference sample metadata is present.";

  return [
    `Speak as ${request.personaName} in a natural private voice note.`,
    request.voiceSampleUrl ? sampleHint : "No playable voice sample is available.",
    "Use conversational Turkish timing, warm but not theatrical delivery, and keep it short.",
    "Do not add sound effects, music, or extra narration.",
  ].join(" ");
}
