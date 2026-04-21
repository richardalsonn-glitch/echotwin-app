"use client";

import { useState, useRef, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageCircle,
  Camera,
  AudioLines,
  Upload,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SubscriptionTier } from "@/types/subscription";
import { validateVoiceSampleFile } from "@/lib/voice/profile";

interface ParticipantStat {
  message_count: number;
  avg_message_length: number;
  question_ratio: number;
  reply_ratio: number;
  short_message_ratio: number;
}

type VoiceUploadStatus = "idle" | "ready" | "uploading" | "done" | "error";

function formatMessageCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}B`;
  return count.toString();
}

function getColorForName(name: string) {
  const colors = [
    "bg-blue-500/15 text-blue-400 border-blue-500/20",
    "bg-purple-500/15 text-purple-400 border-purple-500/20",
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    "bg-orange-500/15 text-orange-400 border-orange-500/20",
    "bg-pink-500/15 text-pink-400 border-pink-500/20",
    "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  ];
  const code = name.codePointAt(0) ?? 65;
  return colors[code % colors.length];
}

function getInitials(name: string): string {
  const stripped = name.replace(/\p{Emoji}/gu, "").trim();
  if (!stripped) return name.slice(0, 2).toUpperCase();
  return stripped
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getApiError(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" && error.trim() ? error : null;
}

async function compressImage(file: File): Promise<Blob> {
  const MAX_DIM = 400;
  const QUALITY = 0.75;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas desteklenmiyor")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error("Sıkıştırma başarısız")); },
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Görsel yüklenemedi")); };
    img.src = objectUrl;
  });
}

function SelectPageContent() {
  const router = useRouter();
const params = useSearchParams();
const exportId = params?.get("export_id") ?? "";
const fileInputRef = useRef<HTMLInputElement>(null);
const voiceInputRef = useRef<HTMLInputElement>(null);

 let participants: string[] = [];
try {
  const raw = params?.get("participants") ?? "[]";
  participants = JSON.parse(raw);
} catch {}

let stats: Record<string, ParticipantStat> = {};
try {
  const raw = params?.get("stats") ?? "{}";
  stats = JSON.parse(raw);
} catch {}

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [requesterName, setRequesterName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceUploadStatus, setVoiceUploadStatus] = useState<VoiceUploadStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptionTier() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      const tier = profile?.subscription_tier;
      setSubscriptionTier(tier === "basic" || tier === "full" ? tier : "free");
    }

    void loadSubscriptionTier();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectTarget(name: string) {
    const otherParticipant =
      participants.length === 2 ? participants.find((p) => p !== name) ?? "" : "";

    setSelectedTarget(name);
    setDisplayName(name);
    if (otherParticipant) setRequesterName(otherParticipant);
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir görsel seç");
      return;
    }
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleVoicePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (subscriptionTier !== "full") {
      toast.error("Ses profili yalnizca Full planda kullanilabilir");
      if (voiceInputRef.current) voiceInputRef.current.value = "";
      return;
    }

    const validation = validateVoiceSampleFile(file);
    if (!validation.ok) {
      toast.error(validation.userMessage);
      if (voiceInputRef.current) voiceInputRef.current.value = "";
      return;
    }

    setVoiceFile(file);
    setVoiceUploadStatus("ready");
    setVoiceError(null);
    if (voiceInputRef.current) voiceInputRef.current.value = "";
  }

  async function uploadVoiceProfile(personaId: string) {
    if (!voiceFile || subscriptionTier !== "full") return;

    setVoiceUploadStatus("uploading");
    setVoiceError(null);

    try {
      const formData = new FormData();
      formData.append("persona_id", personaId);
      formData.append("audio", voiceFile);

      const res = await fetch("/api/voice-profile", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getApiError(data) ?? "Ses profili hazirlanamadi");
      }

      setVoiceUploadStatus("done");
      toast.success("Ses profili hazirlandi");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Ses profili hazirlanamadi";
      console.warn("[voice-profile] upload failed", error);
      setVoiceUploadStatus("error");
      setVoiceError(message);
      toast.error(message);
    }
  }

  async function handleCreate() {
    if (!selectedTarget) { toast.error("Lütfen bir kişi seç"); return; }
    if (!requesterName.trim()) { toast.error("Kendi adını gir"); return; }
    if (!displayName.trim()) { toast.error("Profil adı gir"); return; }

    setLoading(true);

    try {
      // 1. Create persona
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          export_id: exportId,
          target_name: selectedTarget,
          requester_name: requesterName.trim(),
          display_name: displayName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Profil oluşturulamadı");
        if (data.upgrade_required) router.push("/upgrade");
        return;
      }

      const personaId: string = data.persona.id;

      // 2. Upload avatar if one was selected
      if (avatarFile) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const compressed = await compressImage(avatarFile);
            const storagePath = `${user.id}/${personaId}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from("avatars")
              .upload(storagePath, compressed, { upsert: true, contentType: "image/jpeg" });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(storagePath);
              // Save avatar URL to persona
              await fetch(`/api/personas/${personaId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatar_url: urlData.publicUrl }),
              });
            }
            // Avatar upload failure is non-fatal — continue to analyzing
          }
        } catch {
          // Non-fatal: proceed without avatar
        }
      }

      // Optional target voice sample. Failure is non-fatal for chat setup.
      if (voiceFile && subscriptionTier === "full") {
        await uploadVoiceProfile(personaId);
      }

      router.push(`/onboarding/analyzing?persona_id=${personaId}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedStat = selectedTarget ? stats[selectedTarget] : null;
  const voiceUploadUnlocked = subscriptionTier === "full";
  const voiceStatusLabel =
    voiceUploadStatus === "uploading"
      ? "Ses profili yukleniyor..."
      : voiceUploadStatus === "done"
      ? "Ses profili hazir"
      : voiceUploadStatus === "error"
      ? voiceError ?? "Ses profili hazirlanamadi"
      : voiceFile
      ? "Yukleme icin hazir"
      : voiceUploadUnlocked
      ? "Istersen atlayabilirsin"
      : "Full planda aktif";

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col ambient-bg">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-white/5 bg-background/50 backdrop-blur-xl">
        <Link href="/onboarding/upload">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Kişi Seç</h1>
          <p className="text-xs text-muted-foreground">Adım 2 / 3</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <div className="h-0.5 flex-1 bg-primary rounded-full" />
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <div className="h-0.5 flex-1 bg-border rounded-full" />
          <div className="h-1.5 w-1.5 rounded-full bg-border" />
        </div>
      </div>

      <div className="flex-1 px-5 py-7 space-y-7">
        {/* Title */}
        <div className="rounded-3xl border border-primary/12 bg-card/45 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
            Kişi seçimi
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Kiminle sohbet etmek istiyorsun?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sohbette {participants.length} kişi var. Aşağıdaki kartlardan konuşmak istediğin kişiyi seç.
          </p>
        </div>

        {/* Participant cards */}
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label className="text-sm font-semibold text-foreground/85">Kişiyi Seç</Label>
              <p className="mt-1 text-xs text-muted-foreground/60">
                En çok mesaj atan kişiler üstte listelenir.
              </p>
            </div>
            <span className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary/80">
              {participants.length} kişi
            </span>
          </div>
          <div className="space-y-2.5 rounded-3xl border border-white/8 bg-white/[0.03] p-2.5">
            {participants.map((name) => {
              const stat = stats[name];
              const msgCount = stat?.message_count ?? null;
              const isSelected = selectedTarget === name;
              const colorClass = getColorForName(name);

              return (
                <button
                  key={name}
                  className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-primary/65 bg-primary/[0.13] shadow-[0_0_28px_rgba(20,184,166,0.16)] ring-1 ring-primary/25"
                      : "border-white/8 bg-[#0f1a2e]/88 shadow-[0_10px_30px_rgba(0,0,0,0.18)] hover:border-primary/35 hover:bg-primary/[0.07] hover:shadow-[0_0_22px_rgba(20,184,166,0.10)]"
                  }`}
                  onClick={() => {
                    handleSelectTarget(name);
                  }}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity ${
                      isSelected ? "opacity-100" : "group-hover:opacity-100"
                    }`}
                    style={{
                      background:
                        "radial-gradient(circle at 18% 18%, rgba(20,184,166,0.16), transparent 38%)",
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <Avatar
                      className={`h-12 w-12 shrink-0 border-2 transition-all ${
                        isSelected ? "border-primary/55 shadow-[0_0_24px_rgba(20,184,166,0.18)]" : colorClass
                      }`}
                    >
                      <AvatarFallback className={`font-bold text-sm ${colorClass}`}>
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-foreground">{name}</p>
                        {isSelected && (
                          <span className="shrink-0 rounded-full border border-primary/25 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Seçildi
                          </span>
                        )}
                      </div>
                      {msgCount !== null && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5 text-primary/65" />
                          <span className="text-xs font-medium text-muted-foreground/70">
                            {formatMessageCount(msgCount)} mesaj
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                        isSelected
                          ? "border-primary/55 bg-primary/20 text-primary"
                          : "border-white/10 bg-white/[0.04] text-white/28 group-hover:border-primary/25 group-hover:text-primary/75"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile setup — shown after selecting a person */}
        {selectedTarget && (
          <div className="space-y-5">
            {/* Avatar upload */}
            <div className="flex items-center gap-5">
              <div className="relative group shrink-0">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  {avatarPreview && <AvatarImage src={avatarPreview} alt={displayName} />}
                  <AvatarFallback className={`font-bold text-base ${getColorForName(selectedTarget)}`}>
                    {getInitials(displayName || selectedTarget)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground/80 mb-0.5">Profil Fotoğrafı</p>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  İsteğe bağlı — avatara tıklayarak ekle
                </p>
                {selectedStat && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <MessageCircle className="h-3 w-3 text-primary/60" />
                    <span className="text-xs text-primary/70 font-medium">
                      {formatMessageCount(selectedStat.message_count)} mesaj analiz edilecek
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Form fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="requester" className="text-sm font-medium text-foreground/70">
                  Sohbetteki Adın
                </Label>
                <Input
                  id="requester"
                  placeholder="Sohbette nasıl görünüyorsun?"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="bg-input/40 border-border/50 rounded-xl h-11 focus:border-primary/50 focus:ring-primary/15 placeholder:text-muted-foreground/50"
                />
                <p className="text-xs text-muted-foreground/60 pl-1">AI seni bu isimle tanır</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-sm font-medium text-foreground/70">
                  Onun Sohbet Adı
                </Label>
                <Input
                  id="displayName"
                  placeholder="Bu profilin adı"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-input/40 border-border/50 rounded-xl h-11 focus:border-primary/50 focus:ring-primary/15 placeholder:text-muted-foreground/50"
                />
                <p className="text-xs text-muted-foreground/60 pl-1">
                  İstersen farklı bir takma ad verebilirsin
                </p>
              </div>
            </div>

            {/* Voice sample upload */}
            <div
              className={`rounded-2xl border p-4 transition-all ${
                voiceUploadUnlocked
                  ? "border-primary/20 bg-primary/6"
                  : "border-border/40 bg-card/35 opacity-70"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    voiceUploadUnlocked
                      ? "bg-primary/15 text-primary"
                      : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  <AudioLines className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground/85">
                      Bu kişiye ait ses kaydı yükle
                    </p>
                    {!voiceUploadUnlocked && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed mt-0.5">
                    Ses dosyası en az 20 sn olmalıdır. Daha gerçekçi bir klon ses kaydı için 1 dakikadan az olmamalıdır.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!voiceUploadUnlocked || loading || voiceUploadStatus === "uploading"}
                  onClick={() => voiceInputRef.current?.click()}
                  className="h-10 px-3 rounded-xl border border-white/10 bg-white/6 text-xs font-medium text-foreground/80 flex items-center gap-2 disabled:cursor-not-allowed disabled:text-muted-foreground/55 disabled:bg-white/3 active:scale-[0.98] transition-all"
                >
                  {voiceUploadStatus === "uploading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {voiceFile ? "Dosyayı değiştir" : "Ses dosyası seç"}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground/75 truncate">
                    {voiceFile?.name ?? (voiceUploadUnlocked ? "MP3, WAV, M4A, WEBM" : "Yukleme kilitli")}
                  </p>
                  <p
                    className={`text-[11px] truncate ${
                      voiceUploadStatus === "error" ? "text-red-300" : "text-muted-foreground/55"
                    }`}
                  >
                    {voiceStatusLabel}
                  </p>
                </div>
              </div>

              <input
                ref={voiceInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                className="hidden"
                disabled={!voiceUploadUnlocked}
                onChange={handleVoicePick}
              />
            </div>
          </div>
        )}

        {/* Hidden form when no target selected yet */}
        {!selectedTarget && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="requester" className="text-sm font-medium text-foreground/70">
                Sohbetteki Adın
              </Label>
              <Input
                id="requester"
                placeholder="Sohbette nasıl görünüyorsun?"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="bg-input/40 border-border/50 rounded-xl h-11 focus:border-primary/50 focus:ring-primary/15 placeholder:text-muted-foreground/50"
              />
              <p className="text-xs text-muted-foreground/60 pl-1">AI seni bu isimle tanır</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-sm font-medium text-foreground/70">
                Onun Sohbet Adı
              </Label>
              <Input
                id="displayName"
                placeholder="Bu profilin adı"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-input/40 border-border/50 rounded-xl h-11 focus:border-primary/50 focus:ring-primary/15 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        )}

        <Button
          className="w-full h-12 rounded-2xl font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow-teal transition-all"
          onClick={handleCreate}
          disabled={loading || !selectedTarget || !requesterName.trim() || !displayName.trim()}
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {voiceUploadStatus === "uploading"
                ? "Ses profili yukleniyor..."
                : avatarFile || voiceFile
                ? "Kaydediliyor..."
                : "Oluşturuluyor..."}
            </>
          ) : (
            <>
              Devam Et, Onu Tanımaya Başla
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function SelectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center ambient-bg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SelectPageContent />
    </Suspense>
  );
}
