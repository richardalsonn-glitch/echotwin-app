export interface ParsedMessage {
  id: string;
  timestamp: Date;
  sender: string;
  content: string;
  is_media: boolean;
  media_file_name: string | null;
  media_type: "image" | "audio" | "video" | "document" | "unknown" | null;
  // Enhanced fields
  conversation_turn_index: number;
  is_reply: boolean;
  message_length: number;
  has_question: boolean;
}

export interface ParsedMediaItem {
  id: string;
  message_id: string;
  sender: string;
  timestamp: Date;
  file_name: string | null;
  media_type: "image" | "audio" | "video" | "document" | "unknown";
  content: string;
  context_before: string[];
  context_after: string[];
}

export interface ParsedChat {
  participants: string[];
  messages: ParsedMessage[];
  media_items: ParsedMediaItem[];
  media_count: number;
  total_messages: number;
  date_range: {
    start: Date;
    end: Date;
  };
  stats: {
    [sender: string]: {
      message_count: number;
      avg_message_length: number;
      question_ratio: number;
      reply_ratio: number;
    };
  };
}
