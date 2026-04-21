"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Persona } from "@/types/persona";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppMenu } from "@/components/app/app-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MoreVertical,
  Trash2,
  User,
  Crown,
  Sparkles,
  Bell,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { tr } from "date-fns/locale";
import {
  getUnreadCount,
  getLastMessage,
  setLastMessage,
  requestNotificationPermission,
  type LastMessage,
} from "@/lib/notifications";

/* ─── Helpers ─────────────────────────────────────────────── */

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getFirstName(name: string): string {
  return name.split(/[\s@.]/)[0] ?? name;
}

function formatLastTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "dün";
  return format(d, "d MMM", { locale: tr });
}

function truncate(str: string, len = 46): string {
  return str.length > len ? str.slice(0, len).trimEnd() + "…" : str;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Günaydın";
  if (h >= 12 && h < 18) return "Merhaba";
  if (h >= 18 && h < 22) return "İyi akşamlar";
  return "İyi geceler";
}

function getAvatarColor(name: string) {
  const palettes = [
    { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/20" },
    { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/20" },
    { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/20" },
    { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/20" },
    { bg: "bg-pink-500/15", text: "text-pink-300", border: "border-pink-500/20" },
    { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/20" },
    { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/20" },
  ];
  const code = name.codePointAt(0) ?? 65;
  return palettes[code % palettes.length];
}

/* ─── Main ───────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState("");
  const [greeting, setGreeting] = useState("");

  /* ── Sync local data ── */
  const syncLocalData = useCallback((ids: string[]) => {
    const counts: Record<string, number> = {};
    const lasts: Record<string, LastMessage> = {};
    for (const id of ids) {
      counts[id] = getUnreadCount(id);
      const lm = getLastMessage(id);
      if (lm) lasts[id] = lm;
    }
    setUnreadCounts(counts);
    setLastMessages(lasts);
  }, []);

  /* ── Load personas + last messages ── */
  async function loadPersonas() {
    const supabase = createClient();

    // Load user name
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const rawName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email ||
        "";
      setUserName(getFirstName(rawName));
    }

    const res = await fetch("/api/personas");
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    const ps: Persona[] = data.personas ?? [];
    setPersonas(ps);
    setLoading(false);

    syncLocalData(ps.map((p) => p.id));

    if (ps.length === 0) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, persona_id, role, content, created_at")
      .in(
        "persona_id",
        ps.map((p) => p.id)
      )
      .order("created_at", { ascending: false })
      .limit(ps.length * 5);

    if (!msgs) return;
    const seen = new Set<string>();
    const merged: Record<string, LastMessage> = {};
    for (const m of msgs) {
      if (!seen.has(m.persona_id)) {
        seen.add(m.persona_id);
        const lm: LastMessage = {
          content: m.content,
          role: m.role as "user" | "assistant",
          created_at: m.created_at,
        };
        merged[m.persona_id] = lm;
        setLastMessage(m.persona_id, lm);
      }
    }
    setLastMessages((prev) => ({ ...prev, ...merged }));
  }

  useEffect(() => {
    setGreeting(getGreeting());
    void loadPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFocus = () => {
      setPersonas((prev) => {
        syncLocalData(prev.map((p) => p.id));
        return prev;
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncLocalData]);

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission();
    toast.success(granted ? "Bildirimler açıldı" : "İzin verilmedi");
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/personas/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPersonas((prev) => prev.filter((p) => p.id !== id));
      toast.success("Profil silindi");
    } else {
      toast.error("Silinemedi");
    }
    setDeleteId(null);
  }

  /* ── Sorted + stats ── */
  const sorted = [...personas].sort((a, b) => {
    const at = lastMessages[a.id]?.created_at ?? a.created_at;
    const bt = lastMessages[b.id]?.created_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  const totalUnread = Object.values(unreadCounts).reduce((s, n) => s + n, 0);
  const lastVisited = sorted[0];

  /* ─────────────────────────────────────────────────────── */

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col" style={{ background: "hsl(220,40%,6%)" }}>

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-20 px-5 py-3.5 flex items-center justify-between bg-transparent backdrop-blur-2xl border-b border-white/4">
        <AppMenu initialAuthenticated />
        <span className="text-[13px] font-semibold gradient-text tracking-wide">Bendeki Sen</span>
        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Hero section ── */}
        <div className="relative px-5 pt-8 pb-7 overflow-hidden">
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-64 w-72 rounded-full opacity-20"
            style={{ background: "radial-gradient(ellipse, hsl(183,82%,46%) 0%, transparent 70%)" }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="text-[13px] text-primary/80 font-medium mb-1 tracking-wide">
              {greeting}
              {greeting && userName ? `, ${userName}` : userName ? userName : ""}
            </p>
            <h1 className="text-[28px] font-bold tracking-tight leading-tight text-foreground">
              {personas.length === 0
                ? "Hâlâ seni bekliyor"
                : personas.length === 1
                ? "Bağlantın hazır"
                : `${personas.length} bağlantın var`}
            </h1>
            <p className="text-[13.5px] text-muted-foreground/70 mt-1.5 leading-relaxed">
              {personas.length === 0
                ? "Bir sohbet yükle, gerisi bizde."
                : totalUnread > 0
                ? `${totalUnread} okunmamış mesajın var.`
                : "Tüm mesajlar okundu."}
            </p>
          </motion.div>

          {/* Stats pills */}
          {!loading && personas.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="flex items-center gap-2 mt-4"
            >
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-[12px] text-foreground/70">
                <User className="h-3 w-3 text-primary/70" />
                {personas.length} profil
              </span>
              {totalUnread > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[12px] text-primary font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
                  {totalUnread} okunmamış
                </span>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Quick actions ── */}
        {lastVisited && (
          <div className="px-5 mb-6">
            <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-3">
              Hızlı Erişim
            </p>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
              <button
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-border/40 bg-card/50 text-[12.5px] text-foreground/80 shrink-0 hover:border-primary/30 hover:bg-card/70 transition-all active:scale-95"
                onClick={() => router.push(`/chat/${lastVisited.id}`)}
              >
                <MessageCircle className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="truncate max-w-[90px]">Son: {lastVisited.display_name}</span>
              </button>
              <Link href="/upgrade">
                <button className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/8 text-[12.5px] text-amber-400/90 shrink-0 hover:bg-amber-500/15 transition-all active:scale-95">
                  <Crown className="h-3.5 w-3.5 shrink-0" />
                  Premium
                </button>
              </Link>
              <button
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-border/40 bg-card/50 text-[12.5px] text-foreground/80 shrink-0 hover:border-primary/30 hover:bg-card/70 transition-all active:scale-95"
                onClick={handleEnableNotifications}
              >
                <Bell className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                Bildirimler
              </button>
            </div>
          </div>
        )}

        {/* ── Conversations ── */}
        <div className="px-5 pb-32">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/3"
                  style={{ opacity: 1 - i * 0.2 }}
                >
                  <Skeleton className="h-14 w-14 rounded-full bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-3.5 w-28 bg-white/5" />
                    <Skeleton className="h-3 w-44 bg-white/5" />
                  </div>
                  <Skeleton className="h-3 w-10 bg-white/5" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            /* ── Premium Empty State ── */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              {/* Visual */}
              <div className="relative mb-8">
                <div
                  className="h-28 w-28 rounded-[2rem] flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(183,82%,12%) 0%, hsl(220,60%,12%) 100%)",
                    border: "1px solid hsl(183,82%,46%,0.25)",
                    boxShadow: "0 0 60px hsl(183,82%,46%,0.15)",
                  }}
                >
                  <Sparkles className="h-12 w-12 text-primary" strokeWidth={1.5} />
                </div>
                {/* Floating dots */}
                <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-primary/60 animate-pulse" />
                <div className="absolute -bottom-1 -left-3 h-2.5 w-2.5 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: "0.5s" }} />
              </div>

              <h2 className="text-[22px] font-bold tracking-tight mb-3 leading-tight">
                Bir sohbet yükle,
                <br />
                <span className="gradient-text">gerisi bizde.</span>
              </h2>
              <p className="text-muted-foreground/65 text-[13.5px] leading-relaxed mb-8 max-w-[260px]">
                WhatsApp sohbetini yükle — sanki o hâlâ karşındaymış gibi konuşmana yardım edelim.
              </p>
              <Link href="/onboarding/upload">
                <button
                  className="flex items-center gap-2.5 px-8 h-13 rounded-2xl font-semibold text-[14px] text-primary-foreground transition-all active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, hsl(183,82%,40%) 0%, hsl(183,82%,36%) 100%)",
                    boxShadow: "0 0 30px hsl(183,82%,46%,0.30)",
                  }}
                >
                  <Plus className="h-4 w-4" />
                  İlk Kişiyi Ekle
                </button>
              </Link>
            </motion.div>
          ) : (
            /* ── Conversation list ── */
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-3">
                Konuşmalar
              </p>
              <AnimatePresence initial={false}>
                <div className="space-y-2.5">
                  {sorted.map((persona, index) => {
                    const lastMsg = lastMessages[persona.id];
                    const unread = unreadCounts[persona.id] ?? 0;
                    const hasAnalysis = !!persona.analysis;
                    const color = getAvatarColor(persona.display_name);

                    return (
                      <motion.div
                        key={persona.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06, duration: 0.3 }}
                      >
                        <div
                          className={`group relative flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all active:scale-[0.985] ${
                            unread > 0
                              ? "border bg-card/70"
                              : "border bg-card/40 hover:bg-card/65"
                          }`}
                          style={{
                            borderColor: unread > 0
                              ? "hsl(183,82%,46%,0.28)"
                              : "rgba(255,255,255,0.06)",
                            boxShadow: unread > 0
                              ? "0 0 20px hsl(183,82%,46%,0.06)"
                              : "none",
                          }}
                          onClick={() => router.push(`/chat/${persona.id}`)}
                        >
                          {/* Unread left accent */}
                          {unread > 0 && (
                            <div
                              className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
                              style={{ background: "hsl(183,82%,46%)" }}
                            />
                          )}

                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <Avatar
                              className={`h-13 w-13 border ${color.border}`}
                              style={{ width: "52px", height: "52px" }}
                            >
                              {persona.avatar_url && (
                                <AvatarImage src={persona.avatar_url} alt={persona.display_name} />
                              )}
                              <AvatarFallback className={`font-bold text-sm ${color.bg} ${color.text}`}>
                                {getInitials(persona.display_name)}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online/analysis indicator */}
                            {hasAnalysis ? (
                              <span
                                className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-background"
                                style={{ background: "hsl(183,82%,46%,0.7)" }}
                              />
                            ) : (
                              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/25" />
                            )}
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`font-semibold text-[13.5px] truncate leading-tight ${
                                  unread > 0 ? "text-foreground" : "text-foreground/85"
                                }`}
                              >
                                {persona.display_name}
                              </span>
                              {!hasAnalysis && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground/45 shrink-0">
                                  analiz bekleniyor
                                </span>
                              )}
                            </div>

                            {lastMsg ? (
                              <p
                                className={`text-[12px] truncate leading-snug ${
                                  unread > 0
                                    ? "text-foreground/80 font-medium"
                                    : "text-muted-foreground/55"
                                }`}
                              >
                                {lastMsg.role === "user" && (
                                  <span className="text-muted-foreground/40">Sen: </span>
                                )}
                                {truncate(lastMsg.content)}
                              </p>
                            ) : (
                              <p className="text-[12px] text-muted-foreground/40 italic">
                                Merhaba de, seni bekliyor…
                              </p>
                            )}
                          </div>

                          {/* Right: time + badge + menu */}
                          <div className="flex flex-col items-end justify-between self-stretch py-0.5 shrink-0 gap-1.5 min-w-[44px]">
                            <span
                              className={`text-[11px] tabular-nums font-medium ${
                                unread > 0 ? "text-primary" : "text-muted-foreground/35"
                              }`}
                            >
                              {lastMsg ? formatLastTime(lastMsg.created_at) : ""}
                            </span>

                            <div className="flex items-center gap-1">
                              {unread > 0 ? (
                                <span
                                  className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center leading-none text-primary-foreground"
                                  style={{ background: "hsl(183,82%,46%)" }}
                                >
                                  {unread > 99 ? "99+" : unread}
                                </span>
                              ) : (
                                <div className="w-5" />
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="h-7 w-7 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/8">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-card border-border/60 rounded-2xl shadow-2xl p-1 w-44"
                                >
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/profile/${persona.id}`);
                                    }}
                                    className="rounded-xl gap-2.5 text-sm py-2.5"
                                  >
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    Profili Düzenle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive rounded-xl gap-2.5 text-sm py-2.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteId(persona.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Sil
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>

              {/* Upgrade nudge — subtle, bottom of list */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6"
              >
                <Link href="/upgrade">
                  <div
                    className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity active:scale-[0.99]"
                    style={{
                      background: "linear-gradient(135deg, hsl(43,100%,10%) 0%, hsl(220,50%,8%) 100%)",
                      border: "1px solid hsl(43,100%,50%,0.15)",
                    }}
                  >
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "hsl(43,100%,50%,0.12)",
                        border: "1px solid hsl(43,100%,50%,0.2)",
                      }}
                    >
                      <Crown className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13.5px] text-amber-200/90 leading-tight">
                        Premium&apos;a Geç
                      </p>
                      <p className="text-[12px] text-amber-500/60 mt-0.5">
                        Sınırsız mesaj ve daha fazlası
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-amber-500/50 shrink-0" />
                  </div>
                </Link>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      {!loading && sorted.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-10 -translate-x-1/2">
          <Link href="/onboarding/upload">
            <motion.button
              whileTap={{ scale: 0.94 }}
              className="flex h-13 items-center gap-2.5 rounded-2xl px-6 text-[13.5px] font-semibold text-primary-foreground shadow-2xl transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(183,82%,40%) 0%, hsl(183,72%,34%) 100%)",
                boxShadow: "0 8px 32px hsl(183,82%,46%,0.35), 0 2px 8px hsl(183,82%,46%,0.20)",
              }}
            >
              <Plus className="h-4 w-4" />
              Yeni Kişi Ekle
            </motion.button>
          </Link>
        </div>
      )}

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/60 rounded-3xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Profili Sil</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Bu profil ve tüm konuşma geçmişi kalıcı olarak silinecek. Emin misin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-border/60">İptal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
