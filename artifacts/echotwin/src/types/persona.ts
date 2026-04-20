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
  message_count_used: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  persona_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
