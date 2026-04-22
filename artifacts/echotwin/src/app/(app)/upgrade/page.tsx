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
import { useI18n } from "@/context/language-context";
import { TIER_PRICES } from "@/lib/subscription/limits";
import type { Language, TranslationKey } from "@/lib/i18n";

type BillingCycle = "monthly" | "yearly";
type PaidTier = "basic" | "full";
type SelectableTier = "free" | PaidTier;

type PlanFeature = {
  icon: LucideIcon;
  labelKey: TranslationKey;
  locked?: boolean;
};

type PlanCard = {
  tier: SelectableTier;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: LucideIcon;
  price: number;
  features: PlanFeature[];
  ctaKey: TranslationKey;
  badgeKey?: TranslationKey;
  featured?: boolean;
  footnoteKey: TranslationKey;
  iconTone: string;
  iconPanel: string;
};

function formatPrice(price: number, language: Language): string {
  if (price === 0) return "₺0";
  const locale = language === "tr" ? "tr-TR" : language === "ja" ? "ja-JP" : "en-US";
  return `₺${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)}`;
}

function getFeatureIconTone(tier: SelectableTier, locked?: boolean): string {
  if (locked) return "text-white/28";
  if (tier === "free") return "text-white/62";
  if (tier === "basic") return "text-yellow-300/82";
  return "text-amber-300/90";
}

export default function UpgradePage() {
  const { language, t } = useI18n();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [selectedTier, setSelectedTier] = useState<SelectableTier>("full");

  const basicPrice =
    billing === "monthly" ? TIER_PRICES.basic.monthly : TIER_PRICES.basic.yearly;
  const fullPrice =
    billing === "monthly" ? TIER_PRICES.full.monthly : TIER_PRICES.full.yearly;

  const plans: PlanCard[] = [
    {
      tier: "free",
      nameKey: "pricing.free.name",
      descriptionKey: "pricing.free.desc",
      icon: MessageCircle,
      price: 0,
      ctaKey: "pricing.free.cta",
      footnoteKey: "pricing.free.foot",
      iconTone: "text-white/92",
      iconPanel: "border-white/14 bg-white/[0.08]",
      features: [
        { icon: MessageCircle, labelKey: "pricing.free.feature.0" },
        { icon: MessageCircle, labelKey: "pricing.free.feature.1" },
        { icon: Check, labelKey: "pricing.free.feature.2" },
        { icon: Sparkles, labelKey: "pricing.free.feature.3" },
        { icon: Lock, labelKey: "pricing.free.feature.4", locked: true },
        { icon: Lock, labelKey: "pricing.free.feature.5", locked: true },
      ],
    },
    {
      tier: "basic",
      nameKey: "pricing.basic.name",
      descriptionKey: "pricing.basic.desc",
      icon: Zap,
      price: basicPrice,
      ctaKey: "pricing.basic.cta",
      footnoteKey: "pricing.basic.foot",
      iconTone: "text-yellow-300",
      iconPanel: "border-yellow-300/24 bg-yellow-300/10 shadow-[0_0_18px_rgba(250,204,21,0.10)]",
      features: [
        { icon: UserPlus, labelKey: "pricing.basic.feature.0" },
        { icon: MessageCircle, labelKey: "pricing.basic.feature.1" },
        { icon: Check, labelKey: "pricing.basic.feature.2" },
        { icon: Check, labelKey: "pricing.basic.feature.3" },
        { icon: Trash2, labelKey: "pricing.basic.feature.4" },
        { icon: BarChart3, labelKey: "pricing.basic.feature.5" },
        { icon: Lock, labelKey: "pricing.basic.feature.6", locked: true },
        { icon: Lock, labelKey: "pricing.basic.feature.7", locked: true },
      ],
    },
    {
      tier: "full",
      nameKey: "pricing.full.name",
      descriptionKey: "pricing.full.desc",
      icon: Crown,
      price: fullPrice,
      ctaKey: "pricing.full.cta",
      badgeKey: "pricing.popular",
      featured: true,
      footnoteKey: "pricing.full.foot",
      iconTone: "text-amber-300",
      iconPanel: "border-amber-300/28 bg-amber-300/12 shadow-[0_0_20px_rgba(251,191,36,0.14)]",
      features: [
        { icon: InfinityIcon, labelKey: "pricing.full.feature.0" },
        { icon: Sparkles, labelKey: "pricing.full.feature.1" },
        { icon: Mic, labelKey: "pricing.full.feature.2" },
        { icon: BarChart3, labelKey: "pricing.full.feature.3" },
        { icon: Check, labelKey: "pricing.full.feature.4" },
        { icon: MessageCircle, labelKey: "pricing.full.feature.5" },
        { icon: Sparkles, labelKey: "pricing.full.feature.6" },
        { icon: Zap, labelKey: "pricing.full.feature.7" },
      ],
    },
  ];

  function handleSubscribe(tier: PaidTier) {
    const planKey = tier === "basic" ? "pricing.basic.name" : "pricing.full.name";
    alert(t("pricing.comingSoon", { plan: t(planKey) }));
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
              aria-label={t("common.back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-white/92">{t("pricing.title")}</h1>
            <p className="truncate text-[11.5px] text-white/42">
              {t("pricing.subtitle")}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/18 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
              <Crown className="h-3.5 w-3.5" />
              {t("pricing.badge")}
            </div>
            <h2 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">
              {t("pricing.hero")}
            </h2>
            <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/48">
              {t("pricing.desc")}
            </p>
          </div>

          <div className="w-full rounded-2xl border border-white/8 bg-white/[0.045] p-1 md:w-[300px]">
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
                  {cycle === "monthly" ? t("pricing.monthly") : t("pricing.yearly")}
                  {cycle === "yearly" && (
                    <span className="ml-1.5 rounded-full bg-primary/18 px-1.5 py-0.5 text-[10px] text-primary">
                      {t("pricing.yearDiscount")}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="-mx-4 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className="flex min-w-max snap-x snap-mandatory gap-3 sm:grid sm:min-w-0 sm:grid-cols-3 sm:gap-3 lg:gap-4">
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
                  className={`premium-card-hover relative flex h-[406px] w-[80vw] max-w-[292px] shrink-0 snap-center cursor-pointer flex-col overflow-hidden rounded-[24px] border p-3.5 outline-none transition-colors duration-300 sm:h-[412px] sm:w-auto sm:max-w-none ${
                    isSelected
                      ? "border-primary/70 bg-[#102735] shadow-[0_0_30px_rgba(20,184,166,0.22)]"
                      : "border-white/8 bg-[#0e1728] shadow-[0_12px_30px_rgba(0,0,0,0.22)] hover:border-primary/28"
                  }`}
                  style={{
                    background: isSelected
                      ? "linear-gradient(150deg, rgba(17,48,58,0.98), rgba(9,24,38,0.98) 58%, rgba(11,18,32,0.98))"
                      : plan.featured
                        ? "linear-gradient(150deg, rgba(14,35,43,0.96), rgba(8,19,32,0.98) 62%, rgba(11,18,32,0.98))"
                        : "linear-gradient(150deg, rgba(15,26,44,0.96), rgba(9,16,30,0.98))",
                  }}
                  animate={{
                    scale: isSelected ? 1.045 : 1,
                    opacity: isSelected ? 1 : 0.84,
                  }}
                  whileHover={{
                    scale: isSelected ? 1.045 : 1.018,
                    opacity: 1,
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.65 }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(20,184,166,0.62), transparent)",
                    }}
                  />
                  {isSelected && (
                    <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-primary/40" />
                  )}
                  {isSelected && (
                    <div className="absolute left-3 top-3 rounded-full border border-primary/30 bg-primary/16 px-2.5 py-1 text-[10px] font-bold text-primary">
                      {t("common.selected")}
                    </div>
                  )}

                  {plan.badgeKey && (
                    <div className="absolute right-3 top-3 rounded-full border border-amber-300/25 bg-amber-300/12 px-2.5 py-1 text-[10px] font-bold text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.12)]">
                      {t(plan.badgeKey)}
                    </div>
                  )}

                  <div className={`mb-3 flex items-start gap-2.5 ${plan.badgeKey ? "pr-24" : ""} ${isSelected ? "pt-7" : ""}`}>
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${plan.iconPanel}`}
                    >
                      <Icon className={`h-5 w-5 ${plan.iconTone}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[17px] font-bold text-white">{t(plan.nameKey)}</h3>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-white/48">
                        {t(plan.descriptionKey)}
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
                      className="mb-3"
                    >
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-[30px] font-black leading-none tracking-tight text-white sm:text-[31px]">
                          {formatPrice(plan.price, language)}
                        </span>
                        <span className="text-[13px] font-medium text-white/38">
                          {t("pricing.perMonth")}
                        </span>
                      </p>
                      <p className="mt-1 h-4 text-[11px] font-semibold text-primary/72">
                        {t(plan.footnoteKey)}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div className="mb-3 space-y-1.5">
                    {plan.features.map(({ icon: FeatureIcon, labelKey, locked }) => (
                      <div
                        key={labelKey}
                        className={`flex items-start gap-2 text-[11.5px] leading-tight ${
                          locked ? "text-white/36" : "text-white/76"
                        }`}
                      >
                        <FeatureIcon
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getFeatureIconTone(
                            plan.tier,
                            locked
                          )}`}
                        />
                        <span>{t(labelKey)}</span>
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
                      {t(plan.ctaKey)}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        <p className="pb-5 text-center text-[12px] leading-relaxed text-white/28">
          {t("pricing.footer")}
        </p>
      </main>
    </div>
  );
}

