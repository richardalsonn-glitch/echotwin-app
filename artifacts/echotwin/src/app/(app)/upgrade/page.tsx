"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Crown,
  Infinity as InfinityIcon,
  Lock,
  MessageCircle,
  Mic,
  Sparkles,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TIER_PRICES } from "@/lib/subscription/limits";

type BillingCycle = "monthly" | "yearly";
type PaidTier = "basic" | "full";
type SelectableTier = "free" | PaidTier;

type PlanFeature = {
  icon: LucideIcon;
  label: string;
  locked?: boolean;
};

type PlanCard = {
  tier: SelectableTier;
  name: string;
  description: string;
  icon: LucideIcon;
  price: number;
  suffix: string;
  features: PlanFeature[];
  cta: string;
  badge?: string;
  featured?: boolean;
  footnote?: string;
};

const PLAN_ORDER: SelectableTier[] = ["free", "basic", "full"];

function formatPrice(price: number): string {
  if (price === 0) return "₺0";
  return `₺${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)}`;
}

export default function UpgradePage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [selectedTier, setSelectedTier] = useState<SelectableTier>("full");

  const basicPrice =
    billing === "monthly" ? TIER_PRICES.basic.monthly : TIER_PRICES.basic.yearly;
  const fullPrice =
    billing === "monthly" ? TIER_PRICES.full.monthly : TIER_PRICES.full.yearly;

  const plans: PlanCard[] = [
    {
      tier: "free",
      name: "Ücretsiz",
      description: "Deneyimi keşfetmek için kısa başlangıç.",
      icon: MessageCircle,
      price: 0,
      suffix: "/ ay",
      cta: "Mevcut Plan",
      features: [
        { icon: MessageCircle, label: "1 profil oluşturma" },
        { icon: MessageCircle, label: "5 mesaj hakkı" },
        { icon: Check, label: "Profil fotoğrafı yükleme" },
        { icon: Lock, label: "Ses özellikleri kapalı", locked: true },
      ],
    },
    {
      tier: "basic",
      name: "Temel",
      description: "Düzenli sohbet ve temel analiz için.",
      icon: Zap,
      price: basicPrice,
      suffix: "/ ay",
      cta: "Temel'e Geç",
      footnote:
        billing === "yearly"
          ? `Yıllık ${formatPrice(basicPrice * 12)}`
          : "Aylık kullanım",
      features: [
        { icon: UserPlus, label: "2 profil oluşturma" },
        { icon: MessageCircle, label: "Aylık 100 mesaj" },
        { icon: Trash2, label: "Sohbet silme" },
        { icon: BarChart3, label: "İlişki analizi" },
      ],
    },
    {
      tier: "full",
      name: "Full",
      description: "Ses, medya ve sınırsız kullanım isteyenler için.",
      icon: Crown,
      price: fullPrice,
      suffix: "/ ay",
      cta: "Full'a Geç",
      badge: "En Çok Tercih Edilen",
      featured: true,
      footnote:
        billing === "yearly"
          ? `Yıllık ${formatPrice(fullPrice * 12)}`
          : `Yıllıkta ${formatPrice(TIER_PRICES.full.yearly)} / ay`,
      features: [
        { icon: InfinityIcon, label: "Sınırsız profil ve mesaj" },
        { icon: Sparkles, label: "Gelişmiş AI yanıtları" },
        { icon: Mic, label: "Ses profili ve sesli mesaj" },
        { icon: BarChart3, label: "Gelişmiş analiz" },
        { icon: Check, label: "Export ve yedekleme" },
      ],
    },
  ];

  function handleSubscribe(tier: PaidTier) {
    alert(
      `${tier === "basic" ? "Temel" : "Full"} plan aboneliği yakında aktif olacak! Şimdilik ücretsiz devam edebilirsin.`
    );
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>, tier: SelectableTier) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedTier(tier);
  }

  function handleCtaClick(tier: SelectableTier) {
    setSelectedTier(tier);
    if (tier === "basic" || tier === "full") handleSubscribe(tier);
  }

  return (
    <div className="min-h-[100svh] bg-[#0B1220] text-white">
      <header
        className="sticky top-0 z-20 border-b border-white/6 bg-[#0a1121]/90 backdrop-blur-2xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/home">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/70 transition-colors hover:border-primary/30 hover:text-primary"
              aria-label="Geri dön"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-white/92">Üyelik Paketleri</h1>
            <p className="truncate text-[11.5px] text-white/42">
              Paketleri karşılaştır, sana uygun deneyimi seç
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/18 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
              <Crown className="h-3.5 w-3.5" />
              Bendeki Sen Premium
            </div>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">
              Daha fazla konuş, daha gerçek hisset.
            </h2>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-white/48">
              Tüm paketleri tek yerde karşılaştır. Seçtiğin kart öne çıkar, CTA
              butonu da ona göre belirginleşir.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-white/8 bg-white/[0.045] p-1 md:w-[320px]">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBilling(cycle)}
                className={`relative h-10 w-1/2 rounded-xl text-[13px] font-semibold transition-all ${
                  billing === cycle ? "text-white" : "text-white/40 hover:text-white/65"
                }`}
              >
                {billing === cycle && (
                  <motion.span
                    layoutId="billing-active"
                    className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/16 shadow-[0_0_20px_rgba(20,184,166,0.18)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">
                  {cycle === "monthly" ? "Aylık" : "Yıllık"}
                  {cycle === "yearly" && (
                    <span className="ml-1.5 rounded-full bg-primary/18 px-1.5 py-0.5 text-[10px] text-primary">
                      %10
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="-mx-4 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className="flex min-w-max snap-x snap-mandatory gap-3 sm:grid sm:min-w-0 sm:grid-cols-3 sm:gap-4 lg:gap-5">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isSelected = selectedTier === plan.tier;
              const isPaid = plan.tier === "basic" || plan.tier === "full";

              return (
                <motion.article
                  key={plan.tier}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTier(plan.tier)}
                  onKeyDown={(event) => handleCardKeyDown(event, plan.tier)}
                  className={`relative flex h-[410px] w-[78vw] max-w-[300px] shrink-0 snap-center cursor-pointer flex-col overflow-hidden rounded-[26px] border p-4 outline-none transition-colors sm:h-[438px] sm:w-auto sm:max-w-none ${
                    isSelected
                      ? "border-primary/70 bg-[#0f2530] shadow-[0_0_34px_rgba(20,184,166,0.22)]"
                      : "border-white/8 bg-[#0e1728] shadow-[0_18px_44px_rgba(0,0,0,0.28)] hover:border-primary/30"
                  } ${plan.featured ? "sm:-translate-y-2" : ""}`}
                  style={{
                    background: plan.featured
                      ? "linear-gradient(150deg, rgba(12,42,50,0.98), rgba(8,20,34,0.98) 58%, rgba(11,18,32,0.98))"
                      : "linear-gradient(150deg, rgba(16,27,46,0.98), rgba(9,16,30,0.98))",
                  }}
                  animate={{
                    scale: isSelected ? 1.05 : 1,
                    y: plan.featured ? -6 : 0,
                  }}
                  whileHover={{
                    scale: isSelected ? 1.05 : 1.02,
                    y: plan.featured ? -10 : -4,
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(20,184,166,0.62), transparent)",
                    }}
                  />
                  {isSelected && (
                    <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-inset ring-primary/40" />
                  )}

                  {plan.badge && (
                    <div className="absolute right-3 top-3 rounded-full border border-primary/30 bg-primary/16 px-2.5 py-1 text-[10.5px] font-bold text-primary shadow-[0_0_18px_rgba(20,184,166,0.18)]">
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-4 flex items-start gap-3 pr-20">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                        isSelected
                          ? "border-primary/35 bg-primary/16 text-primary"
                          : "border-white/10 bg-white/[0.05] text-white/58"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[18px] font-bold text-white">{plan.name}</h3>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                        {plan.description}
                      </p>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${plan.tier}-${billing}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.14 }}
                      className="mb-4"
                    >
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-[34px] font-black leading-none tracking-tight text-white">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-[13px] font-medium text-white/38">{plan.suffix}</span>
                      </p>
                      <p className="mt-1 h-4 text-[11.5px] font-medium text-primary/70">
                        {plan.footnote ?? "Başlangıç paketi"}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div className="mb-4 space-y-2.5">
                    {plan.features.map(({ icon: FeatureIcon, label, locked }) => (
                      <div
                        key={label}
                        className={`flex items-start gap-2.5 text-[12.5px] leading-snug ${
                          locked ? "text-white/35" : "text-white/76"
                        }`}
                      >
                        <FeatureIcon
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            locked ? "text-white/28" : "text-primary/82"
                          }`}
                        />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCtaClick(plan.tier);
                      }}
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13.5px] font-bold transition-all active:scale-[0.98] ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-[0_0_24px_rgba(20,184,166,0.32)]"
                          : "border border-white/10 bg-white/[0.055] text-white/62 hover:border-primary/25 hover:text-primary"
                      }`}
                    >
                      {isPaid && plan.tier === "full" ? <Crown className="h-4 w-4" /> : null}
                      {isPaid && plan.tier === "basic" ? <Zap className="h-4 w-4" /> : null}
                      {!isPaid ? <Check className="h-4 w-4" /> : null}
                      {plan.cta}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        <div className="grid gap-3 rounded-3xl border border-white/8 bg-white/[0.035] p-3 text-[12px] text-white/45 sm:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const plan = plans.find((item) => item.tier === tier);
            return (
              <div key={tier} className="flex items-center gap-2 rounded-2xl bg-white/[0.025] px-3 py-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    selectedTier === tier ? "bg-primary shadow-[0_0_12px_rgba(20,184,166,0.7)]" : "bg-white/20"
                  }`}
                />
                <span className="truncate">
                  {plan?.name}: {plan ? formatPrice(plan.price) : ""}
                </span>
              </div>
            );
          })}
        </div>

        <p className="pb-6 text-center text-[12px] leading-relaxed text-white/28">
          İstediğin zaman iptal edebilirsin. Güvenli ödeme altyapısı aktif olduğunda
          seçtiğin paketle devam edebilirsin.
        </p>
      </main>
    </div>
  );
}
