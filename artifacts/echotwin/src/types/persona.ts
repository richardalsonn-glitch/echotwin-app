export interface PersonaAnalysis {
  avg_message_length: number;
  short_reply_ratio: number;
  emoji_usage: {
    frequency: "never" | "rare" | "moderate" | "frequent";
    common_emojis: string[];
  };
  tone_style: string;
  affection_level: number;
  argument_style: string;
  common_phrases: string[];
  style_examples?: string[];
  response_patterns: {
    tends_to_ask_back: boolean;
    uses_long_messages: boolean;
    uses_abbreviations: boolean;
    sends_multiple_messages: boolean;
  };
  do_not_behaviors: string[];
  mood_distribution: {
    casual: number;
    flirty: number;
    moody: number;
    argumentative: number;
    soft: number;
  };
  signature_openings: string[];
  language_mix: "turkish_only" | "mostly_turkish" | "mixed" | "mostly_english" | "english_only";
}

export interface Persona {
  id: string;
  user_id: string;
  export_id: string | null;
  target_name: string;
  requester_name: string;
  display_name: string;
  avatar_url: string | null;
  analysis: PersonaAnalysis | null;
  analysis_status?: AnalysisStatus | null;
  analysis_error_code?: string | null;
  analysis_provider?: string | null;
  analysis_attempt_count?: number | null;
  analysis_completed_at?: string | null;
  analysis_summary_cache?: Record<string, unknown> | null;
  message_count_used: number;
  voice_sample_url: string | null;
  voice_profile_status: VoiceProfileStatus;
  voice_enabled: boolean;
  voice_profile_metadata: VoiceProfileMetadata | null;
  voice_message_sent: boolean;
  voice_message_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VoiceProfileStatus = "none" | "processing" | "ready" | "failed";

export type AnalysisStatus =
  | "queued"
  | "processing"
  | "retrying"
  | "completed"
  | "completed_basic"
  | "failed";

export interface VoiceProfileMetadata {
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  uploaded_at: string;
  provider: "sample-only" | "elevenlabs";
  elevenlabs_voice_id?: string;
  duration_estimate_seconds: number | null;
}

export type ChatMessageType = "text" | "voice" | "image";

export interface ChatMessage {
  id: string;
  persona_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  message_type: ChatMessageType;
  audio_url: string | null;
  image_url: string | null;
  audio_duration_seconds: number | null;
  voice_provider: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  media_metadata: Record<string, unknown> | null;
  created_at: string;
}
