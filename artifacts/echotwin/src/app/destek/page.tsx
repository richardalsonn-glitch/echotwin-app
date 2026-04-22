"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileUp,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Paperclip,
  ServerCrash,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppMenu } from "@/components/app/app-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SupportCategoryId = "account" | "billing" | "chat" | "technical";

type SupportCategory = {
  id: SupportCategoryId;
  title: string;
  description: string;
  icon: typeof UserRound;
};

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: "account",
    title: "Hesap ve üyelik",
    description: "Giriş, profil ve hesap erişimi",
    icon: UserRound,
  },
  {
    id: "billing",
    title: "Ödeme ve paketler",
    description: "Plan, yükseltme ve ödeme soruları",
    icon: CreditCard,
  },
  {
    id: "chat",
    title: "Sohbet / analiz sorunu",
    description: "Persona, yanıt veya analiz davranışı",
    icon: MessageCircle,
  },
  {
    id: "technical",
    title: "Teknik hata / yükleme problemi",
    description: "Dosya, medya veya sistem hatası",
    icon: ServerCrash,
  },
];

export default function SupportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<SupportCategoryId | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Ek dosya 20 MB'dan büyük olamaz.");
      return;
    }

    setAttachment(file);
    toast.success("Dosya eklendi.");
  }

  async function handleSubmit() {
    if (!selectedCategory) {
      toast.error("Önce destek konusunu seç.");
      return;
    }

    if (subject.trim().length < 3) {
      toast.error("Konu başlığını biraz daha net yaz.");
      return;
    }

    if (description.trim().length < 10) {
      toast.error("Açıklama kısmını biraz daha detaylandır.");
      return;
    }

    setSubmitting(true);
    setTicketId(null);

    try {
      const formData = new FormData();
      formData.append("category", selectedCategory);
      formData.append("subject", subject.trim());
      formData.append("description", description.trim());
      if (attachment) formData.append("attachment", attachment);

      const response = await fetch("/api/support", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ticketId?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Talep oluşturulamadı, tekrar dene.");
        return;
      }

      setTicketId(payload.ticketId ?? null);
      setSubject("");
      setDescription("");
      setAttachment(null);
      setSelectedCategory(null);
      toast.success("Destek talebin alındı.");
    } catch (error) {
      console.warn("[support] submit failed", error);
      toast.error("Talep oluşturulamadı, bağlantını kontrol edip tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100svh] bg-[#0B1220] text-white">
      <AppMenu floating />

      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-5 pb-8 pt-20">
        <header className="mb-6">
          <div className="mb-5 flex items-center justify-between">
            <Link
              href="/home"
              className="premium-pressable inline-flex h-9 items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 text-xs font-semibold text-white/62 transition-colors hover:border-primary/25 hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Geri
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Güvenli destek
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26 }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">
              Yardım Merkezi
            </p>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">
              Destek
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Sorununu bize ilet, en kısa sürede inceleyelim.
            </p>
          </motion.div>
        </header>

        {ticketId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-3xl border border-primary/22 bg-primary/10 p-4 shadow-[0_0_34px_rgba(20,184,166,0.08)]"
          >
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-white/90">
                  Talebin alındı
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  Takip numaran:{" "}
                  <span className="font-semibold text-primary">{ticketId}</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <section className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-white/88">
                Hızlı konular
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SUPPORT_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const selected = selectedCategory === category.id;

                return (
                  <motion.button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "premium-pressable min-h-[118px] rounded-3xl border p-3 text-left outline-none transition-all",
                      selected
                        ? "border-primary/55 bg-primary/[0.13] shadow-[0_0_28px_rgba(20,184,166,0.13)]"
                        : "border-white/8 bg-white/[0.045] hover:border-primary/24 hover:bg-white/[0.065]"
                    )}
                    animate={{ scale: selected ? 1.025 : 1 }}
                    transition={{ type: "spring", stiffness: 330, damping: 28 }}
                  >
                    <span
                      className={cn(
                        "mb-3 flex h-9 w-9 items-center justify-center rounded-2xl border",
                        selected
                          ? "border-primary/35 bg-primary/18 text-primary"
                          : "border-white/8 bg-white/[0.05] text-white/58"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="block text-[13px] font-semibold leading-tight text-white/88">
                      {category.title}
                    </span>
                    <span className="mt-1.5 block text-[11.5px] leading-snug text-white/42">
                      {category.description}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="premium-panel rounded-3xl p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/68">
                  Konu
                </Label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Kısaca neyle ilgili?"
                  className="h-12 rounded-2xl border-white/8 bg-white/[0.06] text-sm text-white placeholder:text-white/28 focus-visible:ring-primary/35"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/68">
                  Açıklama
                </Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Yaşadığın sorunu, hangi adımda olduğunu ve mümkünse kısa detayları yaz."
                  className="min-h-[132px] resize-none rounded-2xl border-white/8 bg-white/[0.06] text-sm leading-relaxed text-white placeholder:text-white/28 focus-visible:ring-primary/35"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/68">
                  Dosya veya ekran görüntüsü
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="premium-pressable flex min-h-[76px] w-full items-center gap-3 rounded-3xl border border-dashed border-primary/25 bg-primary/[0.055] px-4 text-left transition-colors hover:bg-primary/[0.08]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/24 bg-primary/12 text-primary">
                    <FileUp className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white/86">
                      Dosya ekle
                    </span>
                    <span className="mt-1 block text-xs text-white/42">
                      Görsel veya dosya, en fazla 20 MB.
                    </span>
                  </span>
                </button>

                {attachment && (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] px-3 py-2.5">
                    <Paperclip className="h-4 w-4 shrink-0 text-primary/80" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white/80">
                        {attachment.name}
                      </p>
                      <p className="text-[11px] text-white/38">
                        {(attachment.size / 1024 / 1024).toFixed(2)} MB eklendi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="premium-pressable flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.05] text-white/50 hover:text-red-200"
                      aria-label="Dosyayı kaldır"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Link href="/home" className="flex-1">
              <button
                type="button"
                className="premium-pressable h-12 w-full rounded-2xl border border-white/8 bg-white/[0.055] text-sm font-semibold text-white/64 transition-colors hover:border-white/14 hover:text-white/78"
              >
                İptal
              </button>
            </Link>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="premium-pressable flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_0_26px_rgba(20,184,166,0.26)] transition-opacity disabled:opacity-55"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              Talep Oluştur
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
