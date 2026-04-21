export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_CHAT_UPLOAD_BYTES = 50 * 1024 * 1024;

export type MediaValidation =
  | { ok: true }
  | { ok: false; status: number; userMessage: string; debugMessage: string };

export function validateImageFile(file: File): MediaValidation {
  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      status: 400,
      userMessage: "Lutfen desteklenen bir fotograf dosyasi sec",
      debugMessage: `Unsupported image type: ${file.type}`,
    };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      userMessage: "Fotograf dosyasi 50 MB'dan buyuk olamaz",
      debugMessage: `Image is too large: ${file.size} bytes`,
    };
  }

  if (file.size < 1) {
    return {
      ok: false,
      status: 400,
      userMessage: "Fotograf dosyasi okunamadi, tekrar dene",
      debugMessage: "Image file is empty",
    };
  }

  return { ok: true };
}

export function validateAudioFileSize(file: File): MediaValidation {
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      status: 413,
      userMessage: "Ses dosyasi 50 MB'dan buyuk olamaz",
      debugMessage: `Audio is too large: ${file.size} bytes`,
    };
  }

  if (file.size < 1) {
    return {
      ok: false,
      status: 400,
      userMessage: "Ses dosyasi okunamadi, tekrar dene",
      debugMessage: "Audio file is empty",
    };
  }

  return { ok: true };
}
