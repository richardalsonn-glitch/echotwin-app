export interface ParsedMessage {
  id: string;
  timestamp: Date;
  sender: string;
  content: string;
  is_media: boolean;
  // Enhanced fields
  conversation_turn_index: number;
  is_reply: boolean;
  message_length: number;
  has_question: boolean;
}

export interface ParsedChat {
  participants: string[];
  messages: ParsedMessage[];
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
