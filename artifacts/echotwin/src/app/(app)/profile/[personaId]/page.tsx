"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Persona } from "@/types/persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Save,
  MessageCircle,
  Brain,
  Camera,
  X,
  ImageOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [persona, setPersona] = useState<Persona | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    loadPersona();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId]);

  async function loadPersona() {
    const res = await fetch(`/api/personas/${personaId}`);
    if (res.ok) {
      const { persona: p } = await res.json();
      setPersona(p);
      setDisplayName(p.display_name);
      setAvatarPreview(p.avatar_url ?? null);
    } else {
      toast.error("Profil bulunamadı");
      router.push("/home");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error("Profil adı boş olamaz");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });

    if (res.ok) {
      const { persona: p } = await res.json();
      setPersona(p);
      toast.success("Kaydedildi");
    } else {
      toast.error("Kayıt başarısız");
    }
    setSaving(false);
  }

  /**
   * Resize & compress image to JPEG using Canvas API.
   * Output: max 400×400px, JPEG quality 0.75 → typically 15–40 KB.
   * This keeps Supabase Storage uploads small and avoids 413 errors.
   */
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
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Sıkıştırma başarısız"));
          },
          "image/jpeg",
          QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Görsel yüklenemedi"));
      };
      img.src = objectUrl;
    });
  }

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Geçersiz dosya türü — lütfen bir fotoğraf seç");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Fotoğraf 15MB'dan büyük olamaz");
      return;
    }

    // Instant local preview (blob URL — not sent to server)
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setUploadingAvatar(true);

    try {
      // Step 1: compress to ≤ ~40KB JPEG
      const compressed = await compressImage(file);

      // Step 2: upload compressed blob to Supabase Storage
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const storagePath = `${user.id}/${personaId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, compressed, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        // Give a clear, actionable error — never fall back to base64
        const msg = uploadError.message ?? "";
        if (
          msg.includes("bucket") ||
          msg.includes("not found") ||
          msg.includes("Object not found")
        ) {
          toast.error(
            "Storage kurulu değil — SUPABASE_SETUP.sql dosyasındaki bölüm 7'yi çalıştır",
            { duration: 6000 }
          );
        } else {
          toast.error(`Yükleme hatası: ${msg}`);
        }
        setAvatarPreview(persona?.avatar_url ?? null);
        return;
      }

      // Step 3: get public URL and save to DB (just a short string)
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(storagePath);

      await saveAvatarUrl(urlData.publicUrl);
      // Replace blob preview with persistent URL
      setAvatarPreview(urlData.publicUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Fotoğraf yüklenemedi: ${msg}`);
      setAvatarPreview(persona?.avatar_url ?? null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveAvatarUrl(url: string) {
    const res = await fetch(`/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Only sends a short URL string — no image data
      body: JSON.stringify({ avatar_url: url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const { persona: p } = await res.json();
    setPersona(p);
    toast.success("Profil fotoğrafı güncellendi");
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch(`/api/personas/${personaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      if (res.ok) {
        const { persona: p } = await res.json();
        setPersona(p);
        setAvatarPreview(null);
        toast.success("Fotoğraf kaldırıldı");
      } else {
        toast.error("Kaldırılamadı");
      }
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setUploadingAvatar(false);
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

  if (loading) {
    return (
      <div className="safe-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!persona) return null;

  const analysis = persona.analysis;

  return (
    <div className="safe-screen mx-auto flex max-w-md flex-col ambient-bg">
      {/* Header */}
      <div className="safe-header sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-background/80 px-4 pb-3 backdrop-blur-xl">
        <Link href="/home">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Geri"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-semibold">Profil Detayları</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Avatar upload area */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-primary/20">
              {avatarPreview ? (
                <AvatarImage src={avatarPreview} alt={persona.display_name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {getInitials(persona.display_name)}
              </AvatarFallback>
            </Avatar>

            {/* Upload overlay */}
            <button
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              type="button"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          <div className="text-center">
            <p className="text-lg font-bold">{persona.display_name}</p>
            <p className="text-sm text-muted-foreground">
              {persona.target_name} olarak klonlandı
            </p>
          </div>

          {/* Avatar actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs rounded-xl border-primary/20 text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <Camera className="h-3.5 w-3.5" />
              Fotoğraf Değiştir
            </Button>
            {avatarPreview && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
              >
                <ImageOff className="h-3.5 w-3.5" />
                Kaldır
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="premium-panel premium-card-hover rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{persona.message_count_used}</p>
            <p className="text-xs text-muted-foreground">Toplam Mesaj</p>
          </div>
          <div className="premium-panel premium-card-hover rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{analysis ? "✓" : "—"}</p>
            <p className="text-xs text-muted-foreground">AI Analiz</p>
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Edit form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Profil Adı</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Profil adı"
              className="rounded-xl"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 rounded-xl"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Kaydet
          </Button>
        </div>

        {/* Analysis summary */}
        {analysis && (
          <>
            <Separator className="bg-border/30" />
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Kişilik Analizi
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="premium-panel rounded-2xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Ton</p>
                  <p className="font-medium capitalize">{analysis.tone_style}</p>
                </div>
                <div className="premium-panel rounded-2xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Emoji</p>
                  <p className="font-medium capitalize">
                    {analysis.emoji_usage?.frequency === "never"
                      ? "Kullanmaz"
                      : analysis.emoji_usage?.frequency === "rare"
                      ? "Nadiren"
                      : analysis.emoji_usage?.frequency === "moderate"
                      ? "Zaman zaman"
                      : "Çok sık"}
                  </p>
                </div>
                <div className="premium-panel rounded-2xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Duygu Yoğunluğu</p>
                  <p className="font-medium">{analysis.affection_level}/10</p>
                </div>
                <div className="premium-panel rounded-2xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Ortalama Uzunluk</p>
                  <p className="font-medium">{analysis.avg_message_length} kr.</p>
                </div>
              </div>

              {analysis.common_phrases?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Sık Kullandığı İfadeler</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.common_phrases.slice(0, 6).map((phrase: string) => (
                      <Badge key={phrase} variant="secondary" className="text-xs rounded-lg">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="premium-panel rounded-3xl p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                  Konuşma izi
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                    <p className="text-[11px] text-muted-foreground">Hitap tavrı</p>
                    <p className="mt-1 text-sm font-semibold text-white/88">
                      {analysis.response_patterns?.tends_to_ask_back
                        ? "Soru ile döner"
                        : "Direkt yanıtlar"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                    <p className="text-[11px] text-muted-foreground">Mesaj ritmi</p>
                    <p className="mt-1 text-sm font-semibold text-white/88">
                      {analysis.response_patterns?.sends_multiple_messages
                        ? "Parça parça yazar"
                        : "Tek mesajda toparlar"}
                    </p>
                  </div>
                </div>
                {analysis.signature_openings?.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      İmza başlangıçlar
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.signature_openings.slice(0, 4).map((opening) => (
                        <span
                          key={opening}
                          className="rounded-full border border-primary/18 bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary/85"
                        >
                          {opening}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Button
          variant="outline"
          className="w-full gap-2 rounded-xl"
          onClick={() => router.push(`/chat/${personaId}`)}
        >
          <MessageCircle className="h-4 w-4" />
          Konuşmaya Git
        </Button>

        {/* Remove avatar (bottom) */}
        {avatarPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-xs text-muted-foreground hover:text-destructive rounded-xl"
            onClick={handleRemoveAvatar}
            disabled={uploadingAvatar}
          >
            <X className="h-3.5 w-3.5" />
            Profil fotoğrafını kaldır
          </Button>
        )}
      </div>
    </div>
  );
}
