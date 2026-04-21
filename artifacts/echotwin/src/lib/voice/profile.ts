import type { SubscriptionTier } from "@/types/subscription";
import type { VoiceProfileMetadata } from "@/types/persona";
import { MAX_AUDIO_BYTES } from "@/lib/media/limits";

export const VOICE_SAMPLE_BUCKET = "voice-samples";
export const VOICE_MESSAGE_BUCKET = "voice-messages";

export const VOICE_SAMPLE_MIN_BYTES = 8 * 1024;
export const VOICE_SAMPLE_MAX_BYTES = MAX_AUDIO_BYTES;

export type VoiceSampleValidation =
  | { ok: true }
  | { ok: false; status: number; userMessage: string; debugMessage: string };

export function canUsePersonaVoice(tier: SubscriptionTier): boolean {
  return tier === "full";
}

export function validateVoiceSampleFile(file: File): VoiceSampleValidation {
  if (file.size < VOICE_SAMPLE_MIN_BYTES) {
    return {
      ok: false,
      status: 400,
      userMessage: "Ses ornegi okunamadi, daha net bir kayit yukle",
      debugMessage: `Voice sample is too small: ${file.size} bytes`,
    };
  }

  if (file.size > VOICE_SAMPLE_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      userMessage: "Ses dosyasi 50 MB'dan buyuk olamaz",
      debugMessage: `Voice sample is too large: ${file.size} bytes`,
    };
  }

  if (file.type && !file.type.startsWith("audio/")) {
    return {
      ok: false,
      status: 400,
      userMessage: "Lutfen desteklenen bir ses dosyasi yukle",
      debugMessage: `Unsupported voice sample type: ${file.type}`,
    };
  }

  return { ok: true };
}

export function createVoiceProfileMetadata(
  file: File,
  storagePath: string,
  uploadedAt: string
): VoiceProfileMetadata {
  return {
    file_name: file.name || "voice-sample",
    content_type: file.type || "audio/mpeg",
    size_bytes: file.size,
    storage_path: storagePath,
    uploaded_at: uploadedAt,
    provider: "sample-only",
    duration_estimate_seconds: estimateAudioDurationSeconds(file.size, file.type),
  };
}

export function createVoiceSampleStoragePath(
  userId: string,
  personaId: string,
  file: File
): string {
  const extension = getExtensionForAudioFile(file);
  return `${userId}/${personaId}/${Date.now()}-${createSafeFileStem(file.name)}.${extension}`;
}

export function createVoiceMessageStoragePath(
  userId: string,
  personaId: string,
  extension: string
): string {
  return `${userId}/${personaId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function estimateAudioDurationSeconds(sizeBytes: number, contentType: string): number | null {
  const lowerType = contentType.toLowerCase();
  const bitrateKbps =
    lowerType.includes("webm") || lowerType.includes("ogg")
      ? 64
      : lowerType.includes("wav")
      ? 705
      : 128;

  const seconds = Math.round((sizeBytes * 8) / (bitrateKbps * 1000));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function getExtensionForAudioFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;

  const type = file.type.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  return "mp3";
}

function createSafeFileStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "") || "voice-sample";
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return safe || "voice-sample";
}
