"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Persona, ChatMessage } from "@/types/persona";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Crown,
  Lock,
  Loader2,
  Check,
  CheckCheck,
  Mic,
  Square,
  Play,
  Pause,
  AudioLines,
  ImagePlus,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import {
  createAudioFile,
  discardAudioRecording,
  getAudioRecorderUserMessage,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_MS,
  MIN_AUDIO_BYTES,
  startAudioRecording,
  stopAudioRecording,
  type AudioRecorderSession,
} from "@/lib/audio/recorder";
import { validateImageFile } from "@/lib/media/limits";
import {
  clearUnread,
  incrementUnread,
  setLastMessage,
  playNotificationSound,
  showBrowserNotification,
  requestNotificationPermission,
} from "@/lib/notifications";

const FREE_LIMIT = 5;

/* ─── Types ─────────────────────────────────────────────── */

type MessageStatus = "sent" | "delivered" | "read";
type PresenceState = "idle" | "online" | "typing" | "recent_online";
type VoiceInputStatus = "idle" | "recording" | "transcribing";
type PhotoInputStatus = "idle" | "uploading";

interface DisplayMessage extends ChatMessage {
  status?: MessageStatus;
}

type ChatStreamEvent = {
  type: string;
  content?: string;
  message?: string | Partial<ChatMessage>;
  message_count_used?: number;
  voice_message_pending?: boolean;
  delay?: number;
  hold_ms?: number;
  typing_ms?: number;
  parts?: string[];
};

/* ─── Tick icon ──────────────────────────────────────────── */

function TickIcon({ status }: { status: MessageStatus }) {
  if (status === "sent") return <Check className="h-3 w-3 text-white/35" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-white/35" />;
  return <CheckCheck className="h-3 w-3 text-primary" />;
}

/* ─── Presence label ─────────────────────────────────────── */

function PresenceLabel({
  presence,
  lastSeenAt,
}: {
  presence: PresenceState;
  lastSeenAt: Date;
}) {
  if (presence === "typing") {
    return (
      <span className="text-primary font-medium inline-flex items-center gap-0.5">
        yazıyor
        <span className="inline-flex gap-0.5 ml-1">
          <span className="typing-dot h-[3px] w-[3px] rounded-full bg-primary" />
          <span className="typing-dot h-[3px] w-[3px] rounded-full bg-primary" />
          <span className="typing-dot h-[3px] w-[3px] rounded-full bg-primary" />
        </span>
      </span>
    );
  }
  if (presence === "online" || presence === "recent_online") {
    return <span className="text-green-400">çevrimiçi</span>;
  }
  const now = new Date();
  const isToday = lastSeenAt.toDateString() === now.toDateString();
  const timeStr = format(lastSeenAt, "HH:mm");
  return (
    <span className="text-muted-foreground">
      {isToday
        ? `son görülme bugün ${timeStr}`
        : `son görülme ${formatDistanceToNow(lastSeenAt, { locale: tr, addSuffix: true })}`}
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────── */

function getObjectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getTranscribedText(value: unknown): string | null {
  const data = getObjectValue(value);
  return typeof data.text === "string" && data.text.trim() ? data.text.trim() : null;
}

function getTranscribeError(value: unknown): string {
  const data = getObjectValue(value);
  return typeof data.error === "string" && data.error.trim()
    ? data.error.trim()
    : "Ses mesajı okunamadı, tekrar dene";
}

function getVoiceMessageFromValue(value: unknown, personaId: string): DisplayMessage | null {
  const data = getObjectValue(value);
  const content = typeof data.content === "string" ? data.content : "";
  const audioUrl = typeof data.audio_url === "string" ? data.audio_url : null;

  if (!content.trim() || !audioUrl) return null;

  return {
    id: typeof data.id === "string" ? data.id : `ai-voice-${Date.now()}`,
    persona_id: typeof data.persona_id === "string" ? data.persona_id : personaId,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    role: "assistant",
    content,
    message_type: "voice",
    audio_url: audioUrl,
    image_url: null,
    audio_duration_seconds:
      typeof data.audio_duration_seconds === "number" ? data.audio_duration_seconds : null,
    voice_provider: typeof data.voice_provider === "string" ? data.voice_provider : null,
    media_mime_type: typeof data.media_mime_type === "string" ? data.media_mime_type : null,
    media_size_bytes: typeof data.media_size_bytes === "number" ? data.media_size_bytes : null,
    media_metadata: null,
    created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
  };
}

function getDisplayMessageFromValue(value: unknown, personaId: string): DisplayMessage | null {
  const data = getObjectValue(value);
  const role = data.role === "user" || data.role === "assistant" ? data.role : null;
  const content = typeof data.content === "string" ? data.content : "";
  const messageType =
    data.message_type === "voice" || data.message_type === "image" || data.message_type === "text"
      ? data.message_type
      : "text";

  if (!role || !content.trim()) return null;

  return {
    id: typeof data.id === "string" ? data.id : `msg-${Date.now()}`,
    persona_id: typeof data.persona_id === "string" ? data.persona_id : personaId,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    role,
    content,
    message_type: messageType,
    audio_url: typeof data.audio_url === "string" ? data.audio_url : null,
    image_url: typeof data.image_url === "string" ? data.image_url : null,
    audio_duration_seconds:
      typeof data.audio_duration_seconds === "number" ? data.audio_duration_seconds : null,
    voice_provider: typeof data.voice_provider === "string" ? data.voice_provider : null,
    media_mime_type: typeof data.media_mime_type === "string" ? data.media_mime_type : null,
    media_size_bytes: typeof data.media_size_bytes === "number" ? data.media_size_bytes : null,
    media_metadata: null,
    created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
    status: role === "user" ? "read" : undefined,
  };
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = use(params);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recordingSessionRef = useRef<AudioRecorderSession | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceMessageRequestRef = useRef(false);

  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [loading, setLoading] = useState(true);

  const [streamingContent, setStreamingContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [presence, setPresence] = useState<PresenceState>("idle");
  const [lastSeenAt, setLastSeenAt] = useState<Date>(new Date());
  const [startingConvo, setStartingConvo] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoInputStatus>("idle");
  const [playingVoiceMessageId, setPlayingVoiceMessageId] = useState<string | null>(null);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Scroll ── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, isTyping, scrollToBottom]);

  /* ── Presence helpers ── */
  function clearPresenceTimer() {
    if (presenceTimerRef.current) {
      clearTimeout(presenceTimerRef.current);
      presenceTimerRef.current = null;
    }
  }

  function clearScheduledTimers() {
    scheduledTimersRef.current.forEach(clearTimeout);
    scheduledTimersRef.current = [];
  }

  function clearRecordingTimeout() {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }

  useEffect(
    () => () => {
      clearPresenceTimer();
      clearScheduledTimers();
      clearRecordingTimeout();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (recordingSessionRef.current) {
        discardAudioRecording(recordingSessionRef.current);
        recordingSessionRef.current = null;
      }
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current = null;
      }
    },
    []
  );

  /* ── Idle re-engagement: persona messages after silence ── */
  function scheduleIdleReengagement() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    // Random wait: 10–30 minutes, fires with 55% probability
    const delayMs = 10 * 60_000 + Math.random() * 20 * 60_000;
    idleTimerRef.current = setTimeout(async () => {
      if (Math.random() > 0.55) return; // skip this time
      try {
        const res = await fetch("/api/chat/idle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona_id: personaId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.message?.content) {
          const serverMsg = data.message as Partial<ChatMessage>;
          const idleMsg: DisplayMessage = {
            id: serverMsg.id ?? `ai-idle-${Date.now()}`,
            persona_id: serverMsg.persona_id ?? personaId,
            user_id: serverMsg.user_id ?? "",
            role: "assistant",
            content: data.message.content,
            message_type: serverMsg.message_type ?? "text",
            audio_url: serverMsg.audio_url ?? null,
            image_url: serverMsg.image_url ?? null,
            audio_duration_seconds: serverMsg.audio_duration_seconds ?? null,
            voice_provider: serverMsg.voice_provider ?? null,
            media_mime_type: serverMsg.media_mime_type ?? null,
            media_size_bytes: serverMsg.media_size_bytes ?? null,
            media_metadata: serverMsg.media_metadata ?? null,
            created_at: serverMsg.created_at ?? new Date().toISOString(),
          };
          setMessages((prev) => [...prev, idleMsg]);
          if (data.message_count_used !== undefined) {
            setPersona((p) =>
              p ? { ...p, message_count_used: data.message_count_used } : p
            );
            if (data.message_count_used >= FREE_LIMIT) void checkLimit();
          }
          setPresence("recent_online");
          presenceTimerRef.current = setTimeout(() => {
            setLastSeenAt(new Date());
            setPresence("idle");
          }, 4000);
          onResponseDelivered(
            data.message.content,
            persona?.display_name ?? "AI",
            persona?.avatar_url ?? undefined
          );
        }
      } catch {
        // non-critical
      }
    }, delayMs);
  }

  /* ── Notification helper: called ONCE per AI response (not per part) ── */
  function onResponseDelivered(
    content: string,
    personaName: string,
    avatarUrl?: string
  ) {
    // Update last message cache for home screen
    setLastMessage(personaId, {
      content,
      role: "assistant",
      created_at: new Date().toISOString(),
    });

    if (document.hidden) {
      // Page in background: sound + browser notification + unread badge
      incrementUnread(personaId);
      playNotificationSound("incoming");
      showBrowserNotification(personaName, content.slice(0, 100), avatarUrl);
    } else {
      // User is watching: single soft chime
      playNotificationSound("soft");
    }

    // Schedule idle re-engagement after this AI response
    scheduleIdleReengagement();
  }

  /* ── Conversation starter: persona sends first message ── */
  async function handleStartConvo() {
    if (startingConvo) return;
    setStartingConvo(true);
    setPresence("online");
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Başlatılamadı");
        setPresence("idle");
        return;
      }

      const data = await res.json();
      const incoming: DisplayMessage[] = (data.messages ?? []).map(
        (m: Partial<ChatMessage> & { role: string; content: string }, i: number) => ({
          id: m.id ?? `ai-start-${Date.now()}-${i}`,
          persona_id: m.persona_id ?? personaId,
          user_id: m.user_id ?? "",
          role: m.role as "user" | "assistant",
          content: m.content,
          message_type: m.message_type ?? "text",
          audio_url: m.audio_url ?? null,
          image_url: m.image_url ?? null,
          audio_duration_seconds: m.audio_duration_seconds ?? null,
          voice_provider: m.voice_provider ?? null,
          media_mime_type: m.media_mime_type ?? null,
          media_size_bytes: m.media_size_bytes ?? null,
          media_metadata: m.media_metadata ?? null,
          created_at: m.created_at ?? new Date().toISOString(),
        })
      );

      // Deliver parts with natural typing gaps
      for (let i = 0; i < incoming.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));
        setMessages((prev) => [...prev, incoming[i]]);
      }

      setPresence("recent_online");
      presenceTimerRef.current = setTimeout(() => {
        setLastSeenAt(new Date());
        setPresence("idle");
      }, 4000);

      if (incoming.length > 0) {
        const last = incoming[incoming.length - 1];
        onResponseDelivered(last.content, persona?.display_name ?? "AI", persona?.avatar_url ?? undefined);
      }
      if (data.message_count_used !== undefined) {
        setPersona((p) =>
          p ? { ...p, message_count_used: data.message_count_used } : p
        );
        if (data.message_count_used >= FREE_LIMIT) void checkLimit();
      }
    } catch {
      toast.error("Bağlantı hatası");
      setPresence("idle");
    } finally {
      setStartingConvo(false);
    }
  }

  /* ── Load ── */
  useEffect(() => {
    setMounted(true);
    loadPersonaAndMessages();
    // Clear unread immediately when entering this chat
    clearUnread(personaId);
    // Request notification permission gently on first chat open
    void requestNotificationPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId]);

  async function loadPersonaAndMessages() {
    try {
      const personaRes = await fetch(`/api/personas/${personaId}`);
      if (!personaRes.ok) {
        toast.error("Profil bulunamadı");
        router.push("/home");
        return;
      }
      const { persona: p } = await personaRes.json();
      setPersona(p);
      setLastSeenAt(new Date(p.updated_at ?? Date.now()));

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("subscription_tier")
        .eq("id", user?.id ?? "")
        .single();

      const tier = profile?.subscription_tier ?? "free";
      if (tier === "free" && p.message_count_used >= FREE_LIMIT) {
        setLimitReached(true);
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("persona_id", personaId)
        .order("created_at", { ascending: true })
        .limit(50);

      const displayMsgs: DisplayMessage[] = (msgs ?? []).map(
        (m: ChatMessage) => ({
          ...m,
          status: m.role === "user" ? ("read" as MessageStatus) : undefined,
        })
      );
      setMessages(displayMsgs);

      // Cache last message for home screen
      if (msgs && msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        setLastMessage(personaId, {
          content: last.content,
          role: last.role as "user" | "assistant",
          created_at: last.created_at,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Send ── */
  async function handleVoiceButtonClick() {
    if (voiceStatus === "recording") {
      await finishVoiceRecording();
      return;
    }

    if (voiceStatus !== "idle" || sending || limitReached) return;
    await startVoiceInput();
  }

  async function startVoiceInput() {
    try {
      setVoiceError(null);
      const session = await startAudioRecording();
      recordingSessionRef.current = session;
      setVoiceStatus("recording");
      recordingTimeoutRef.current = setTimeout(() => {
        void finishVoiceRecording();
      }, MAX_RECORDING_MS);
    } catch (error) {
      const message = getAudioRecorderUserMessage(error);
      console.warn("[voice-input] recording failed", error);
      setVoiceStatus("idle");
      setVoiceError(message);
      toast.error(message);
    }
  }

  async function finishVoiceRecording() {
    const session = recordingSessionRef.current;
    if (!session) return;
    recordingSessionRef.current = null;

    clearRecordingTimeout();
    setVoiceStatus("transcribing");
    setVoiceError(null);

    try {
      const audioBlob = await stopAudioRecording(session);

      if (audioBlob.size < MIN_AUDIO_BYTES) {
        throw new Error("Ses mesajı okunamadı, tekrar dene");
      }

      if (audioBlob.size > MAX_AUDIO_BYTES) {
        throw new Error("Ses kaydı çok uzun, daha kısa tekrar dene");
      }

      const formData = new FormData();
      formData.append("audio", createAudioFile(audioBlob));

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getTranscribeError(data));
      }

      const transcript = getTranscribedText(data);
      if (!transcript) {
        throw new Error("Ses mesajı okunamadı, tekrar dene");
      }

      setVoiceStatus("idle");
      setVoiceError(null);
      await sendMessage(transcript);
    } catch (error) {
      console.warn("[voice-input] transcription failed", error);
      recordingSessionRef.current = null;
      setVoiceStatus("idle");
      const rawMessage = error instanceof Error ? error.message : "";
      const message = rawMessage.startsWith("Ses ")
        ? rawMessage
        : "Ses mesajı okunamadı, tekrar dene";
      setVoiceError(message);
      toast.error(message);
    }
  }

  function stopVoicePlayback() {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
    setPlayingVoiceMessageId(null);
  }

  async function toggleVoicePlayback(message: DisplayMessage) {
    if (!message.audio_url) return;

    if (playingVoiceMessageId === message.id) {
      stopVoicePlayback();
      return;
    }

    stopVoicePlayback();

    const audio = new Audio(message.audio_url);
    voiceAudioRef.current = audio;
    setPlayingVoiceMessageId(message.id);

    audio.onended = () => {
      if (voiceAudioRef.current === audio) {
        voiceAudioRef.current = null;
        setPlayingVoiceMessageId(null);
      }
    };
    audio.onerror = () => {
      if (voiceAudioRef.current === audio) {
        voiceAudioRef.current = null;
        setPlayingVoiceMessageId(null);
      }
      toast.error("Sesli mesaj oynatilamadi");
    };

    try {
      await audio.play();
    } catch (error) {
      console.warn("[voice-message] playback failed", error);
      stopVoicePlayback();
      toast.error("Sesli mesaj oynatilamadi");
    }
  }

  async function requestVoiceMessage(text: string, messageCountUsed: number) {
    if (voiceMessageRequestRef.current || !text.trim()) return;
    voiceMessageRequestRef.current = true;

    try {
      const res = await fetch("/api/voice-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: personaId,
          text,
          message_count_used: messageCountUsed,
        }),
      });

      if (!res.ok) return;

      const data: unknown = await res.json().catch(() => ({}));
      const payload = getObjectValue(data);
      const voiceMessage = getVoiceMessageFromValue(payload.message, personaId);
      if (!voiceMessage) return;

      setMessages((prev) => [...prev, voiceMessage]);
      setPersona((p) =>
        p
          ? {
              ...p,
              voice_message_sent: true,
              voice_message_sent_at: voiceMessage.created_at,
            }
          : p
      );
      onResponseDelivered(
        "Sesli mesaj",
        persona?.display_name ?? "AI",
        persona?.avatar_url ?? undefined
      );
    } catch (error) {
      console.warn("[voice-message] request failed", error);
    } finally {
      voiceMessageRequestRef.current = false;
    }
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file || sending || limitReached || photoStatus !== "idle") return;
    await sendPhotoMessage(file);
  }

  async function sendPhotoMessage(file: File) {
    const validation = validateImageFile(file);
    if (!validation.ok) {
      toast.error(validation.userMessage);
      return;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    const caption = input.trim();
    setInput("");
    setSending(true);
    setPhotoStatus("uploading");
    setPresence("online");

    try {
      const formData = new FormData();
      formData.append("persona_id", personaId);
      formData.append("image", file);
      if (caption) formData.append("caption", caption);

      const res = await fetch("/api/chat/photo", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await res.json().catch(() => ({}));
      const payload = getObjectValue(data);

      if (!res.ok) {
        if (payload.limit_reached) setLimitReached(true);
        toast.error(typeof payload.error === "string" ? payload.error : "Fotograf gonderilemedi");
        return;
      }

      const userMessage = getDisplayMessageFromValue(payload.user_message, personaId);
      const assistantMessage = getDisplayMessageFromValue(payload.assistant_message, personaId);
      if (userMessage || assistantMessage) {
        setMessages((prev) => [
          ...prev,
          ...(userMessage ? [userMessage] : []),
          ...(assistantMessage ? [assistantMessage] : []),
        ]);
      }

      if (typeof payload.message_count_used === "number") {
        setPersona((p) =>
          p ? { ...p, message_count_used: payload.message_count_used as number } : p
        );
        if (payload.message_count_used >= FREE_LIMIT) void checkLimit();
      }

      if (assistantMessage) {
        onResponseDelivered(
          assistantMessage.content,
          persona?.display_name ?? "AI",
          persona?.avatar_url ?? undefined
        );
        if (
          payload.voice_message_pending === true &&
          typeof payload.message_count_used === "number"
        ) {
          void requestVoiceMessage(assistantMessage.content, payload.message_count_used);
        }
      }

      setPresence("recent_online");
      const seenTime = new Date();
      clearPresenceTimer();
      presenceTimerRef.current = setTimeout(() => {
        setLastSeenAt(seenTime);
        setPresence("idle");
      }, 4000);
    } catch (error) {
      console.warn("[chat-photo] send failed", error);
      toast.error("Fotograf gonderilemedi, tekrar dene");
      setPresence("idle");
    } finally {
      setSending(false);
      setPhotoStatus("idle");
      inputRef.current?.focus();
    }
  }

  async function sendMessage(messageOverride?: string) {
    const content = (messageOverride ?? input).trim();
    if (!content || sending || limitReached) return;

    // Clear any pending idle re-engagement when user actively sends
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (messageOverride === undefined) setInput("");
    setSending(true);

    const optId = `opt-${Date.now()}`;

    const optimisticMsg: DisplayMessage = {
      id: optId,
      persona_id: personaId,
      user_id: "",
      role: "user",
      content,
      message_type: "text",
      audio_url: null,
      image_url: null,
      audio_duration_seconds: null,
      voice_provider: null,
      media_mime_type: null,
      media_size_bytes: null,
      media_metadata: null,
      created_at: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Cache user message as last message on home screen
    setLastMessage(personaId, {
      content,
      role: "user",
      created_at: new Date().toISOString(),
    });

    clearPresenceTimer();
    setPresence("online");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaId, message: content }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.limit_reached) {
          setLimitReached(true);
          toast.error(data.error);
        } else {
          toast.error(data.error ?? "Mesaj gönderilemedi");
        }
        setMessages((prev) => prev.filter((m) => m.id !== optId));
        clearPresenceTimer();
        setPresence("idle");
        return;
      }

      /* ── SSE parsing ── */
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as ChatStreamEvent;

            if (event.type === "typing_delay") {
              setIsTyping(true);
              setStreamingContent("");
              clearPresenceTimer();
              setPresence("typing");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === optId && m.status === "sent"
                    ? { ...m, status: "delivered" as MessageStatus }
                    : m
                )
              );
            } else if (event.type === "chunk") {
              setIsTyping(false);
              fullResponse += event.content ?? "";
              setStreamingContent(fullResponse);
            } else if (event.type === "message") {
              // Immediate mode: each response part → separate bubble
              // Sound/notification fires once on "done" (not here per-part)
              setIsTyping(false);
              setStreamingContent("");
              if (event.content) {
                const partMsg: DisplayMessage = {
                  id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  persona_id: personaId,
                  user_id: "",
                  role: "assistant",
                  content: event.content,
                  message_type: "text",
                  audio_url: null,
                  image_url: null,
                  audio_duration_seconds: null,
                  voice_provider: null,
                  media_mime_type: null,
                  media_size_bytes: null,
                  media_metadata: null,
                  created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, partMsg]);
              }
            } else if (event.type === "scheduled") {
              const holdMs = event.hold_ms ?? 60_000;
              const typingMs = event.typing_ms ?? 2500;
              const parts = event.parts ?? [];
              const newCount = event.message_count_used;

              setIsTyping(false);
              setStreamingContent("");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === optId && m.status === "sent"
                    ? { ...m, status: "delivered" as MessageStatus }
                    : m
                )
              );
              clearPresenceTimer();
              setPresence("idle");

              // Phase 1: offline for (holdMs - typingMs - 500)ms
              const onlineAt = Math.max(0, holdMs - typingMs - 500);
              const t1 = setTimeout(() => setPresence("online"), onlineAt);

              // Phase 2: typing
              const t2 = setTimeout(() => {
                setPresence("typing");
                setIsTyping(true);
              }, holdMs - typingMs);

              // Phase 3: deliver messages
              const t3 = setTimeout(() => {
                setIsTyping(false);
                parts.forEach((part, i) => {
                  const tPart = setTimeout(() => {
                    const newMsg: DisplayMessage = {
                      id: `ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
                      persona_id: personaId,
                      user_id: "",
                      role: "assistant",
                      content: part,
                      message_type: "text",
                      audio_url: null,
                      image_url: null,
                      audio_duration_seconds: null,
                      voice_provider: null,
                      media_mime_type: null,
                      media_size_bytes: null,
                      media_metadata: null,
                      created_at: new Date().toISOString(),
                    };
                    setMessages((prev) => [...prev, newMsg]);

                    // On the last part: sound, notification, presence cleanup
                    if (i === parts.length - 1) {
                      onResponseDelivered(
                        part,
                        persona?.display_name ?? "AI",
                        persona?.avatar_url ?? undefined
                      );
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === optId
                            ? { ...m, status: "read" as MessageStatus }
                            : m
                        )
                      );
                      if (newCount !== undefined) {
                        setPersona((p) =>
                          p ? { ...p, message_count_used: newCount } : p
                        );
                        if (newCount >= FREE_LIMIT) checkLimit();
                      }
                      clearPresenceTimer();
                      setPresence("recent_online");
                      const seenTime = new Date();
                      presenceTimerRef.current = setTimeout(() => {
                        setLastSeenAt(seenTime);
                        setPresence("idle");
                      }, 4000);
                    }
                  }, i * 700);
                  scheduledTimersRef.current.push(tPart);
                });
              }, holdMs);

              scheduledTimersRef.current.push(t1, t2, t3);
            } else if (event.type === "done") {
              setIsTyping(false);
              setStreamingContent("");
              const deliveredText = (fullResponse || event.content || "").trim();
              setMessages((prev) => {
                const withReadStatus = prev.map((m) =>
                  m.id === optId ? { ...m, status: "read" as MessageStatus } : m
                );

                if (!deliveredText) return withReadStatus;

                return [
                  ...withReadStatus,
                  {
                    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    persona_id: personaId,
                    user_id: "",
                    role: "assistant",
                    content: deliveredText,
                    message_type: "text",
                    audio_url: null,
                    image_url: null,
                    audio_duration_seconds: null,
                    voice_provider: null,
                    media_mime_type: null,
                    media_size_bytes: null,
                    media_metadata: null,
                    created_at: new Date().toISOString(),
                  },
                ];
              });
              if (event.message_count_used !== undefined) {
                setPersona((p) =>
                  p ? { ...p, message_count_used: event.message_count_used! } : p
                );
              }
              // Play sound once per response (fullResponse accumulated from chunks)
              if (deliveredText) {
                onResponseDelivered(
                  deliveredText,
                  persona?.display_name ?? "AI",
                  persona?.avatar_url ?? undefined
                );
              }
              if (event.voice_message_pending && event.message_count_used !== undefined) {
                void requestVoiceMessage(deliveredText, event.message_count_used);
              }
              clearPresenceTimer();
              setPresence("recent_online");
              const seenTime = new Date();
              presenceTimerRef.current = setTimeout(() => {
                setLastSeenAt(seenTime);
                setPresence("idle");
              }, 4000);
              if ((event.message_count_used ?? 0) >= FREE_LIMIT) checkLimit();
            } else if (event.type === "error") {
              toast.error(typeof event.message === "string" ? event.message : "AI hatası");
              setIsTyping(false);
              setStreamingContent("");
              setMessages((prev) => prev.filter((m) => m.id !== optId));
              clearPresenceTimer();
              setPresence("idle");
            }
          } catch {
            // Silently ignore malformed SSE lines
          }
        }
      }
    } catch {
      toast.error("Bağlantı hatası");
      setMessages((prev) => prev.filter((m) => m.id !== optId));
      clearPresenceTimer();
      setPresence("idle");
    } finally {
      setSending(false);
      setIsTyping(false);
      setStreamingContent("");
      inputRef.current?.focus();
    }
  }

  async function checkLimit() {
    try {
      const supabase = createClient();
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("subscription_tier")
        .single();
      if ((prof?.subscription_tier ?? "free") === "free") {
        setLimitReached(true);
      }
    } catch {
      // Non-critical
    }
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function getSpacing(index: number): string {
    if (index === 0) return "";
    return messages[index].role !== messages[index - 1].role ? "mt-4" : "mt-1";
  }

  function showAvatar(index: number): boolean {
    const next = messages[index + 1];
    return !next || next.role !== "assistant";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0B1220" }}>
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!persona) return null;

  const onlineDot =
    presence === "online" ||
    presence === "recent_online" ||
    presence === "typing";
  const voiceStatusText =
    photoStatus === "uploading"
      ? "Fotoğraf yükleniyor..."
      : voiceStatus === "recording"
      ? "Dinliyorum..."
      : voiceStatus === "transcribing"
      ? "Ses çözümleniyor..."
      : voiceError;
  const textSendDisabled =
    !input.trim() || sending || voiceStatus !== "idle" || photoStatus !== "idle";

  return (
    <div className="max-w-md mx-auto flex flex-col h-screen" style={{ background: "#0B1220" }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-3 py-2.5"
        style={{
          background: "rgba(10,17,33,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
          boxShadow: "0 1px 12px rgba(0,0,0,0.35)",
        }}
      >
        <Link href="/home">
          <button className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center hover:bg-white/8 transition-colors active:scale-90">
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </button>
        </Link>

        <button
          className="relative shrink-0 active:opacity-75 transition-opacity"
          onClick={() => router.push(`/profile/${personaId}`)}
          type="button"
        >
          <Avatar className="h-10 w-10" style={{ border: "2px solid rgba(20,184,166,0.2)" }}>
            {persona.avatar_url && <AvatarImage src={persona.avatar_url} />}
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
              {getInitials(persona.display_name)}
            </AvatarFallback>
          </Avatar>
          <span
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 transition-colors duration-700"
            style={{
              background: onlineDot ? "#22c55e" : "rgba(148,163,184,0.25)",
              borderColor: "#0B1220",
            }}
          />
        </button>

        <button
          className="flex-1 min-w-0 text-left active:opacity-75 transition-opacity"
          onClick={() => router.push(`/profile/${personaId}`)}
          type="button"
        >
          <p className="font-semibold text-[14.5px] text-white/92 leading-tight truncate tracking-tight">
            {persona.display_name}
          </p>
          <p className="text-[11.5px] mt-[1px] leading-none">
            {mounted ? (
              <PresenceLabel presence={presence} lastSeenAt={lastSeenAt} />
            ) : (
              <span className="text-muted-foreground/60">yükleniyor…</span>
            )}
          </p>
        </button>

        <span
          className="shrink-0 text-[10.5px] text-white/30 px-2.5 py-1 rounded-full font-medium"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {persona.message_count_used}
        </span>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto px-3 pt-4 pb-2"
        style={{
          backgroundImage: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(20,184,166,0.04) 0%, transparent 60%)",
        }}
      >

        {messages.length === 0 && !streamingContent && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="relative mb-5">
              <Avatar
                className="h-24 w-24"
                style={{ border: "2px solid rgba(20,184,166,0.18)", boxShadow: "0 0 40px rgba(20,184,166,0.12)" }}
              >
                {persona.avatar_url && <AvatarImage src={persona.avatar_url} />}
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {getInitials(persona.display_name)}
                </AvatarFallback>
              </Avatar>
              <span
                className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2"
                style={{ background: "rgba(148,163,184,0.25)", borderColor: "#0B1220" }}
              />
            </div>
            <p className="font-bold text-[17px] text-white/90 tracking-tight">{persona.display_name}</p>
            <p className="text-white/40 text-[13.5px] mt-2 leading-relaxed max-w-[200px]">
              Sohbet henüz başlamadı
            </p>

            <div className="mt-7 flex flex-col gap-2.5 w-full max-w-[240px]">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-2xl text-[13.5px] text-white/70 font-medium active:scale-[0.97] transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                onClick={() => inputRef.current?.focus()}
              >
                Sohbeti ben başlatayım
              </button>
              <button
                type="button"
                disabled={startingConvo}
                className="w-full py-3 px-4 rounded-2xl text-[13.5px] text-primary font-semibold active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "rgba(20,184,166,0.10)",
                  border: "1px solid rgba(20,184,166,0.22)",
                  boxShadow: "0 0 16px rgba(20,184,166,0.08)",
                }}
                onClick={() => void handleStartConvo()}
              >
                {startingConvo ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Bekliyor…
                  </>
                ) : (
                  "Sohbeti o başlatsın"
                )}
              </button>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const avatarVisible = !isUser && showAvatar(index);
            const sameAsPrev = index > 0 && messages[index - 1].role === msg.role;
            const sameAsNext = index < messages.length - 1 && messages[index + 1].role === msg.role;
            const isVoiceMessage = !isUser && msg.message_type === "voice" && Boolean(msg.audio_url);
            const isImageMessage = msg.message_type === "image" && Boolean(msg.image_url);
            const isPlayingVoice = playingVoiceMessageId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-1.5 ${
                  sameAsPrev ? "mt-0.5" : "mt-3"
                }`}
              >
                {/* Avatar placeholder on left */}
                {!isUser && (
                  <div className="w-8 shrink-0 flex items-end justify-center pb-0.5">
                    {avatarVisible ? (
                      <Avatar className="h-8 w-8" style={{ border: "1.5px solid rgba(20,184,166,0.15)" }}>
                        {persona.avatar_url && <AvatarImage src={persona.avatar_url} />}
                        <AvatarFallback className="bg-primary/12 text-primary text-[10px] font-bold">
                          {getInitials(persona.display_name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8" />
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[76%] ${isUser ? "bubble-sent" : "bubble-received"} ${
                    isVoiceMessage
                      ? "px-3 py-2.5 min-w-[210px]"
                      : isImageMessage
                      ? "p-1.5 min-w-[190px]"
                      : "px-3.5 py-2"
                  }`}
                  style={
                    isUser
                      ? { borderRadius: sameAsPrev ? "18px 5px 5px 18px" : sameAsNext ? "18px 18px 5px 18px" : undefined }
                      : { borderRadius: sameAsPrev ? "5px 18px 18px 5px" : sameAsNext ? "5px 18px 18px 18px" : undefined }
                  }
                >
                  {isImageMessage ? (
                    <div className="space-y-1.5">
                      <img
                        src={msg.image_url ?? ""}
                        alt="Gönderilen fotoğraf"
                        className="max-h-72 w-full rounded-[14px] object-cover"
                        loading="lazy"
                      />
                      {msg.content && msg.content !== "Fotograf gonderildi" && (
                        <p className="px-1 text-[13px] leading-[1.4] whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}
                    </div>
                  ) : isVoiceMessage ? (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        aria-label={isPlayingVoice ? "Sesli mesajı duraklat" : "Sesli mesajı oynat"}
                        className="h-9 w-9 rounded-full bg-primary/18 border border-primary/25 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                        onClick={() => void toggleVoicePlayback(msg)}
                      >
                        {isPlayingVoice ? (
                          <Pause className="h-4 w-4 text-primary fill-primary" />
                        ) : (
                          <Play className="h-4 w-4 text-primary fill-primary ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <AudioLines className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                          <span className="text-[13px] font-medium text-white/86">Sesli mesaj</span>
                        </div>
                        <div className="mt-1.5 h-5 flex items-center gap-[3px]" aria-hidden="true">
                          {[10, 16, 22, 13, 19, 25, 15, 21, 12, 18, 24, 14].map((height, waveIndex) => (
                            <span
                              key={waveIndex}
                              className={`w-[3px] rounded-full ${
                                isPlayingVoice ? "bg-primary/80" : "bg-white/28"
                              }`}
                              style={{
                                height,
                                opacity: isPlayingVoice ? 0.55 + (waveIndex % 4) * 0.1 : 0.55,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[14px] leading-[1.45] whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}
                  <div
                    className={`flex items-center gap-1 mt-0.5 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <span className={`text-[10.5px] tabular-nums ${isUser ? "text-white/45" : "text-white/35"}`}>
                      {format(new Date(msg.created_at), "HH:mm")}
                    </span>
                    {isUser && msg.status && <TickIcon status={msg.status} />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Streaming bubble */}
        <AnimatePresence>
          {streamingContent && (
            <motion.div
              key="streaming-bubble"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex justify-start items-end gap-1.5 ${
                messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
                  ? "mt-0.5"
                  : "mt-3"
              }`}
            >
              <div className="w-8 shrink-0 pb-0.5">
                <Avatar className="h-8 w-8" style={{ border: "1.5px solid rgba(20,184,166,0.15)" }}>
                  {persona.avatar_url && <AvatarImage src={persona.avatar_url} />}
                  <AvatarFallback className="bg-primary/12 text-primary text-[10px] font-bold">
                    {getInitials(persona.display_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="bubble-received px-3.5 py-2 max-w-[76%]">
                <p className="text-[14px] leading-[1.45] whitespace-pre-wrap break-words">
                  {streamingContent}
                  <span className="inline-block w-[2px] h-3.5 bg-primary/50 ml-0.5 align-middle animate-pulse rounded-full" />
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && !streamingContent && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex justify-start items-end gap-1.5 ${
                messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
                  ? "mt-0.5"
                  : "mt-3"
              }`}
            >
              <div className="w-8 shrink-0 pb-0.5">
                <Avatar className="h-8 w-8" style={{ border: "1.5px solid rgba(20,184,166,0.15)" }}>
                  {persona.avatar_url && <AvatarImage src={persona.avatar_url} />}
                  <AvatarFallback className="bg-primary/12 text-primary text-[10px] font-bold">
                    {getInitials(persona.display_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="bubble-received px-4 py-3">
                <div className="flex items-center gap-[5px]">
                  <span className="typing-dot h-2 w-2 rounded-full bg-white/40" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-white/40" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-white/40" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* ── Paywall ── */}
      <AnimatePresence>
        {limitReached && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mx-3 mb-2 p-4 rounded-2xl backdrop-blur-sm"
            style={{
              background: "rgba(10,17,33,0.90)",
              border: "1px solid rgba(20,184,166,0.18)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.40)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.22)" }}
              >
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13.5px] text-white/90">Mesaj Hakkın Bitti</p>
                <p className="text-[12px] text-white/45 mt-0.5 leading-relaxed">
                  Ücretsiz {FREE_LIMIT} mesaj hakkını kullandın. Konuşmaya devam etmek için bir plan seç.
                </p>
              </div>
            </div>
            <Link href="/upgrade" className="block mt-3">
              <button
                className="w-full h-10 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[13px] text-white active:scale-[0.98] transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(183 82% 34%), hsl(198 80% 41%))",
                  boxShadow: "0 2px 16px rgba(20,184,166,0.35)",
                }}
              >
                <Crown className="h-3.5 w-3.5" />
                Premium&apos;a Geç
              </button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input ── */}
      {!limitReached && (
        <div
          className="px-3 py-3 safe-bottom"
          style={{
            background: "rgba(9,15,28,0.95)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Mesaj yaz…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (voiceStatus === "idle" && photoStatus === "idle") void sendMessage();
                  }
                }}
                disabled={sending}
                className="rounded-3xl h-11 px-4 text-[14px] text-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0 placeholder:text-white/25"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handlePhotoPick(e)}
              />
            </div>
            <button
              type="button"
              aria-label="Fotoğraf gönder"
              title="Fotoğraf gönder"
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-40"
              style={{
                background:
                  photoStatus === "uploading"
                    ? "rgba(20,184,166,0.12)"
                    : "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              onClick={() => photoInputRef.current?.click()}
              disabled={sending || voiceStatus !== "idle" || photoStatus === "uploading"}
            >
              {photoStatus === "uploading" ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 text-white/75" />
              )}
            </button>
            <button
              type="button"
              aria-label={voiceStatus === "recording" ? "Kaydı bitir" : "Sesli mesaj kaydet"}
              title={voiceStatus === "recording" ? "Kaydı bitir" : "Sesli mesaj kaydet"}
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-40"
              style={{
                background:
                  voiceStatus === "recording"
                    ? "rgba(239,68,68,0.16)"
                    : voiceStatus === "transcribing"
                    ? "rgba(20,184,166,0.12)"
                    : "rgba(255,255,255,0.07)",
                border:
                  voiceStatus === "recording"
                    ? "1px solid rgba(239,68,68,0.35)"
                    : "1px solid rgba(255,255,255,0.06)",
                boxShadow:
                  voiceStatus === "recording"
                    ? "0 0 18px rgba(239,68,68,0.18)"
                    : "none",
              }}
              onClick={() => void handleVoiceButtonClick()}
              disabled={sending || photoStatus === "uploading" || voiceStatus === "transcribing"}
            >
              {voiceStatus === "transcribing" ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : voiceStatus === "recording" ? (
                <Square className="h-3.5 w-3.5 text-red-300 fill-red-300" />
              ) : (
                <Mic className="h-4 w-4 text-white/75" />
              )}
            </button>
            <button
              type="button"
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-40"
              style={{
                background:
                  !textSendDisabled
                    ? "linear-gradient(135deg, hsl(183 82% 34%), hsl(198 80% 41%))"
                    : "rgba(255,255,255,0.07)",
                boxShadow:
                  !textSendDisabled
                    ? "0 2px 14px rgba(20,184,166,0.35)"
                    : "none",
              }}
              onClick={() => void sendMessage()}
              disabled={textSendDisabled}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
          {voiceStatusText && (
            <p
              className={`mt-2 px-1 text-[11.5px] ${
                voiceError && voiceStatus === "idle" ? "text-red-300" : "text-white/45"
              }`}
            >
              {voiceStatusText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
