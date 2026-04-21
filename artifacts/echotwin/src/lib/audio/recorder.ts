import { MAX_AUDIO_BYTES as MAX_ALLOWED_AUDIO_BYTES } from "@/lib/media/limits";

export const MIN_AUDIO_BYTES = 1024;
export const MAX_AUDIO_BYTES = MAX_ALLOWED_AUDIO_BYTES;
export const MAX_RECORDING_MS = 60_000;

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export type AudioRecorderSession = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mimeType: string;
  startedAt: number;
};

export class AudioRecorderError extends Error {
  readonly userMessage: string;

  constructor(message: string, userMessage: string) {
    super(message);
    this.name = "AudioRecorderError";
    this.userMessage = userMessage;
  }
}

export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";

  return (
    MIME_TYPE_CANDIDATES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType)
    ) ?? ""
  );
}

export async function startAudioRecording(): Promise<AudioRecorderSession> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new AudioRecorderError(
      "MediaDevices API is not available",
      "Tarayıcı mikrofon kaydını desteklemiyor"
    );
  }

  if (typeof MediaRecorder === "undefined") {
    throw new AudioRecorderError(
      "MediaRecorder API is not available",
      "Tarayıcı mikrofon kaydını desteklemiyor"
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = getSupportedAudioMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    const chunks: Blob[] = [];

    recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    recorder.start(250);

    return {
      recorder,
      stream,
      chunks,
      mimeType: recorder.mimeType || mimeType || "audio/webm",
      startedAt: Date.now(),
    };
  } catch (error) {
    if (isPermissionError(error)) {
      throw new AudioRecorderError(
        "Microphone permission was denied",
        "Mikrofon izni verilmedi"
      );
    }

    throw new AudioRecorderError(
      error instanceof Error ? error.message : "Microphone recording failed",
      "Mikrofon başlatılamadı"
    );
  }
}

export function stopAudioRecording(
  session: AudioRecorderSession
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { recorder } = session;

    const cleanup = () => {
      stopMediaStream(session.stream);
    };

    const handleStop = () => {
      cleanup();
      resolve(new Blob(session.chunks, { type: session.mimeType }));
    };

    const handleError = () => {
      cleanup();
      reject(
        new AudioRecorderError(
          "MediaRecorder failed while stopping",
          "Ses kaydı tamamlanamadı"
        )
      );
    };

    recorder.addEventListener("stop", handleStop, { once: true });
    recorder.addEventListener("error", handleError, { once: true });

    if (recorder.state === "inactive") {
      handleStop();
      return;
    }

    recorder.stop();
  });
}

export function discardAudioRecording(session: AudioRecorderSession) {
  if (session.recorder.state !== "inactive") {
    session.recorder.stop();
  }
  stopMediaStream(session.stream);
}

export function createAudioFile(blob: Blob): File {
  const mimeType = blob.type || "audio/webm";
  return new File([blob], `voice-message.${getExtensionForMimeType(mimeType)}`, {
    type: mimeType,
  });
}

export function getAudioRecorderUserMessage(error: unknown): string {
  if (error instanceof AudioRecorderError) return error.userMessage;
  return "Ses kaydı başlatılamadı";
}

function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function getExtensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function isPermissionError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError" ||
      error.name === "SecurityError")
  );
}
