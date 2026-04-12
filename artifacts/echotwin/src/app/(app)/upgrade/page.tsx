"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  Zap,
  Infinity as InfinityIcon,
  MessageCircle,
  Trash2,
  UserPlus,
  BarChart3,
  Mic,
  Download,
  Phone,
  Camera,
  Lock,
} from "lucide-react";
import { TIER_PRICES } from "@/lib/subscription/limits";

/* ─── Plan data ─────────────────────────────────────────── */

const FREE_FEATURES = [
  { icon: MessageCircle, label: "1 profil oluşturma" },
  { icon: MessageCircle, label: "5 mesaj hakkı" },
  { icon: Check, label: "Profil fotoğrafı yükleme" },
];

const FREE_LOCKED = [
  { icon: Trash2, label: "Sohbet silme" },
  { icon: UserPlus, label: "Yeni kişi ekleme" },
  { icon: BarChart3, label: "İlişki analizi" },
  { icon: Mic, label: "Ses analizi" },
];

const BASIC_FEATURES = [
  { icon: UserPlus, label: "2 profil oluşturma" },
  { icon: MessageCircle, label: "Aylık 100 mesaj hakkı" },
  { icon: Check, label: "Profil fotoğrafı yükleme" },
  { icon: Check, label: "Profil adı düzenleme" },
  { icon: Trash2, label: "Sohbet silme" },
  { icon: BarChart3, label: "İlişki analizi" },
];

const FULL_FEATURES = [
  { icon: InfinityIcon, label: "Sınırsız profil" },
  { icon: InfinityIcon, label: "Sınırsız mesaj" },
  { icon: Zap, label: "Daha gelişmiş AI yanıtlar (GPT-5.2)" },
  { icon: BarChart3, label: "İlişki analizi" },
  { icon: Mic, label: "Ses tonu analizi" },
  { icon: MessageCircle, label: "Sesli mesajlaşma" },
  { icon: Download, label: "Sohbet export & yedekleme" },
  { icon: Check, label: "Tema / arka plan değiştirme" },
];

const COMING_SOON = [
  { icon: Phone, label: "Sesli arama" },
  { icon: Camera, label: "Fotoğraf paylaşımı" },
];

/* ─── Component ─────────────────────────────────────────── */

export default function UpgradePage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const basicPrice =
    billing === "monthly" ? TIER_PRICES.basic.monthly : TIER_PRICES.basic.yearly;
  const fullPrice =
    billing === "monthly" ? TIER_PRICES.full.monthly : TIER_PRICES.full.yearly;

  function handleSubscribe(tier: "basic" | "full") {
    alert(
      `${tier === "basic" ? "Temel" : "Full"} plan aboneliği yakında aktif olacak! Şimdilik ücretsiz devam edebilirsin.`
    );
  }

  return (
    <div
      className="max-w-md mx-auto min-h-screen flex flex-col"
      style={{ background: "#0B1220" }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(10,17,33,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
        }}
      >
        <Link href="/home">
          <button className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/8 transition-colors">
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </button>
        </Link>
        <div>
          <h1 className="font-bold text-[15px] text-white/90">Premium Planlar</h1>
          <p className="text-[11.5px] text-white/40">Daha fazla konuş, daha gerçek hisset</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-7 space-y-5">

        {/* ── Hero ── */}
        <div className="text-center mb-2">
          <div
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-4"
            style={{
              background: "rgba(20,184,166,0.12)",
              border: "1px solid rgba(20,184,166,0.25)",
              boxShadow: "0 0 32px rgba(20,184,166,0.18)",
            }}
          >
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-[26px] font-bold tracking-tight gradient-text">
            Bendeki Sen Premium
          </h2>
          <p className="text-white/45 text-[13.5px] mt-2 leading-relaxed">
            Sınırsız konuş, sanki hep yanındaymış gibi
          </p>
        </div>

        {/* ── Billing toggle ── */}
        <div
          className="flex items-center rounded-2xl p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all"
              style={
                billing === b
                  ? {
                      background: "rgba(20,184,166,0.18)",
                      color: "rgba(255,255,255,0.92)",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
                    }
                  : { color: "rgba(255,255,255,0.40)" }
              }
            >
              {b === "monthly" ? "Aylık" : "Yıllık"}
              {b === "yearly" && (
                <span
                  className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(20,184,166,0.25)", color: "rgba(20,184,166,0.9)" }}
                >
                  %10 indirim
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Free Plan ── */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-[15px] text-white/80">Ücretsiz</span>
            <span
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
            >
              Mevcut Plan
            </span>
          </div>
          <p className="text-[32px] font-bold text-white/90 mb-4">
            ₺0
            <span className="text-[15px] font-normal text-white/35 ml-1">/ay</span>
          </p>
          <div className="space-y-2.5">
            {FREE_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <span className="text-[13px] text-white/55">{label}</span>
              </div>
            ))}
            {FREE_LOCKED.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 opacity-40">
                <Lock className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <span className="text-[13px] text-white/40 line-through">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Basic Plan ── */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "rgba(14,22,40,0.90)",
            border: "1px solid rgba(20,184,166,0.20)",
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.4), transparent)" }}
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary/80" />
              <span className="font-bold text-[15px] text-white/90">Temel</span>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`basic-${billing}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-[32px] font-bold text-white/90 mb-0.5">
                ₺{basicPrice.toFixed(2)}
                <span className="text-[15px] font-normal text-white/35 ml-1">/ay</span>
              </p>
              {billing === "yearly" && (
                <p className="text-[12px] text-primary/70 mb-1">
                  Yıllık faturalandırılır · ₺{(basicPrice * 12).toFixed(2)}/yıl
                </p>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="space-y-2.5 mt-4 mb-5">
            {BASIC_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="text-[13px] text-white/75">{label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleSubscribe("basic")}
            className="w-full h-11 rounded-2xl text-[13.5px] font-semibold transition-all active:scale-[0.98]"
            style={{
              background: "rgba(20,184,166,0.10)",
              border: "1px solid rgba(20,184,166,0.30)",
              color: "rgba(20,184,166,0.9)",
            }}
          >
            Temel&apos;e Geç
          </button>
        </div>

        {/* ── Full Plan — "En Popüler" glow card ── */}
        <div
          className="rounded-2xl relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, rgba(12,36,44,0.95) 0%, rgba(8,24,36,0.98) 100%)",
            border: "1px solid rgba(20,184,166,0.35)",
            boxShadow: "0 0 40px rgba(20,184,166,0.15), 0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          {/* Glow orb */}
          <div
            className="absolute -top-16 -right-16 h-48 w-48 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-0 left-0 right-0 h-[1.5px]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.7), rgba(14,165,233,0.6), rgba(20,184,166,0.7), transparent)" }}
          />

          <div className="relative p-5">
            {/* Badge */}
            <div className="absolute top-4 right-4">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(14,165,233,0.20))",
                  border: "1px solid rgba(20,184,166,0.40)",
                  color: "#2dd4bf",
                }}
              >
                <Zap className="h-3 w-3" />
                En Popüler
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-primary" />
              <span className="font-bold text-[16px] gradient-text">Full</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`full-${billing}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-[38px] font-bold text-white mb-0.5 leading-none">
                  ₺{fullPrice.toFixed(2)}
                  <span className="text-[16px] font-normal text-white/35 ml-1">/ay</span>
                </p>
                {billing === "yearly" && (
                  <p className="text-[12px] text-primary/70 mb-1">
                    Yıllık faturalandırılır · ₺{(fullPrice * 12).toFixed(2)}/yıl
                  </p>
                )}
                {billing === "monthly" && (
                  <p className="text-[12px] text-white/30 mb-1">
                    veya yıllık alırsan ₺{TIER_PRICES.full.yearly.toFixed(2)}/ay
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="space-y-2.5 mt-4 mb-6">
              {FULL_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[13px] text-white/85">{label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe("full")}
              className="w-full h-12 rounded-2xl text-[14px] font-bold text-white transition-all active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(183 82% 34%), hsl(198 80% 41%))",
                boxShadow: "0 4px 20px rgba(20,184,166,0.40)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Crown className="h-4 w-4" />
                Full&apos;a Geç
              </span>
            </button>
          </div>
        </div>

        {/* ── Coming Soon ── */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-[12px] font-semibold text-white/40 uppercase tracking-widest mb-3">
            Yakında
          </p>
          <div className="space-y-2.5">
            {COMING_SOON.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="h-3.5 w-3.5 text-white/25 shrink-0" />
                <span className="text-[13px] text-white/40">{label}</span>
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)" }}
                >
                  Yakında
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[12px] text-white/25 pb-6 leading-relaxed">
          İstediğin zaman iptal edebilirsin.{"\n"}Güvenli ödeme · Türkiye&apos;de hizmet.
        </p>
      </div>
    </div>
  );
}
