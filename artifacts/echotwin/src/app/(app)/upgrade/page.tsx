"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgePercent,
  BarChart3,
  CalendarDays,
  Check,
  Crown,
  Infinity as InfinityIcon,
  Lock,
  MessageCircle,
  Mic,
  Smartphone,
  Sparkles,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/context/language-context";
import { createClient } from "@/lib/supabase/client";
import type { Language, TranslationKey } from "@/lib/i18n";
import {
  createStoreBillingPayload,
  getDiscountedPlanPrice,
  getMonthlyEquivalentPrice,
  type BillingCycle,
  type PaidTier,
  type PricingTier,
  validatePricingCoupon,
} from "@/lib/pricing";
import type { SubscriptionTier, UserProfile } from "@/types/subscription";

type SelectableTier = PricingTier;

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
  features: PlanFeature[];
  ctaKey: TranslationKey;
  badgeKey?: TranslationKey;
  featured?: boolean;
  footnoteKey: TranslationKey;
  iconTone: string;
  iconPanel: string;
};

type CouponFeedback = {
  type: "success" | "error";
  message: string;
};

function formatPrice(price: number, language: Language): string {
  if (price === 0) return "₺0";
  const locale = language === "tr" ? "tr-TR" : language === "ja" ? "ja-JP" : "en-US";
  return `₺${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)}`;
}

function formatDate(value: string | null, language: Language, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const locale = language === "tr" ? "tr-TR" : language === "ja" ? "ja-JP" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getFeatureIconTone(tier: SelectableTier, locked?: boolean): string {
  if (locked) return "text-white/28";
  if (tier === "free") return "text-white/62";
  if (tier === "basic") return "text-yellow-300/82";
  return "text-amber-300/90";
}

function toSubscriptionTier(value: unknown): SubscriptionTier {
  return value === "basic" || value === "full" ? value : "free";
}

function getCouponErrorMessage(
  reason: "empty" | "invalid" | "monthly_only" | "yearly_only",
  t: (key: TranslationKey) => string
): string {
  const keyByReason: Record<typeof reason, TranslationKey> = {
    empty: "pricing.couponEmpty",
    invalid: "pricing.couponInvalid",
    monthly_only: "pricing.couponMonthlyOnly",
    yearly_only: "pricing.couponYearlyOnly",
  };
  return t(keyByReason[reason]);
}

export default function UpgradePage() {
  const { language, t } = useI18n();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [selectedTier, setSelectedTier] = useState<SelectableTier>("full");
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>("free");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<CouponFeedback | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentPlan() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_profiles")
        .select("subscription_tier, subscription_expires_at")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      const profile = data as Pick<UserProfile, "subscription_tier" | "subscription_expires_at"> | null;
      setCurrentTier(toSubscriptionTier(profile?.subscription_tier));
      setSubscriptionExpiresAt(profile?.subscription_expires_at ?? null);
    }

    void loadCurrentPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!appliedCouponCode) return;
    const validation = validatePricingCoupon(appliedCouponCode, billing);
    if (validation.ok) {
      setCouponFeedback({
        type: "success",
        message: t("pricing.couponApplied", {
          code: validation.coupon.code,
          percent: validation.effectivePercentOff,
        }),
      });
      return;
    }

    setAppliedCouponCode(null);
    setCouponFeedback({
      type: "error",
      message: getCouponErrorMessage(validation.reason, t),
    });
  }, [appliedCouponCode, billing, t]);

  const plans: PlanCard[] = useMemo(
    () => [
      {
        tier: "free",
        nameKey: "pricing.free.name",
        descriptionKey: "pricing.free.desc",
        icon: MessageCircle,
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
        tier: "full",
        nameKey: "pricing.full.name",
        descriptionKey: "pricing.full.desc",
        icon: Crown,
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
      {
        tier: "basic",
        nameKey: "pricing.basic.name",
        descriptionKey: "pricing.basic.desc",
        icon: Zap,
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
    ],
    []
  );

  function handleApplyCoupon() {
    const validation = validatePricingCoupon(couponInput, billing);
    if (!validation.ok) {
      setAppliedCouponCode(null);
      setCouponFeedback({
        type: "error",
        message: getCouponErrorMessage(validation.reason, t),
      });
      return;
    }

    setAppliedCouponCode(validation.coupon.code);
    setCouponInput(validation.coupon.code);
    setCouponFeedback({
      type: "success",
      message: t("pricing.couponApplied", {
        code: validation.coupon.code,
        percent: validation.effectivePercentOff,
      }),
    });
  }

  function handleSubscribe(tier: PaidTier) {
    const planKey: TranslationKey = tier === "basic" ? "pricing.basic.name" : "pricing.full.name";
    const billingPayload = createStoreBillingPayload({
      tier,
      cycle: billing,
      couponCode: appliedCouponCode,
    });
    console.info("[pricing] store billing payload prepared", billingPayload);
    alert(t("pricing.storePaymentsSoon", { plan: t(planKey) }));
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

  const currentPlanName = t(
    currentTier === "basic"
      ? "pricing.basic.name"
      : currentTier === "full"
        ? "pricing.full.name"
        : "pricing.free.name"
  );

  return (
    <div className="safe-screen bg-[#0B1220] text-white">
      <header className="safe-header-compact sticky top-0 z-20 border-b border-white/6 bg-[#0a1121]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
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
            <p className="truncate text-[11.5px] text-white/42">{t("pricing.subtitle")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="grid gap-3 lg:grid-cols-[1fr_360px] lg:items-end">
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

          <div className="rounded-[22px] border border-primary/14 bg-white/[0.055] p-3.5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/72">
                  {t("pricing.currentMembership")}
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {t("pricing.currentPlan")}: {currentPlanName}
                </p>
                <p className="mt-0.5 text-[12px] text-white/45">
                  {t("pricing.renewalDate")}:{" "}
                  {formatDate(subscriptionExpiresAt, language, t("pricing.noRenewalDate"))}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="w-full max-w-[320px] rounded-2xl border border-white/8 bg-white/[0.045] p-1">
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

          <div className="-mx-4 overflow-x-auto overflow-y-visible px-5 py-5 [scrollbar-width:none] sm:mx-0 sm:px-2">
            <div className="flex min-w-max snap-x snap-mandatory gap-4 sm:grid sm:min-w-0 sm:grid-cols-3 sm:gap-4 lg:gap-5">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isSelected = selectedTier === plan.tier;
                const isPaid = plan.tier === "basic" || plan.tier === "full";
                const price = getDiscountedPlanPrice({
                  tier: plan.tier,
                  cycle: billing,
                  couponCode: appliedCouponCode,
                });
                const monthlyEquivalent = getMonthlyEquivalentPrice(plan.tier, billing);
                const hasCouponDiscount = price.couponPercentOff > 0 && price.finalPrice < price.basePrice;

                return (
                  <motion.article
                    key={plan.tier}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedTier(plan.tier)}
                    onKeyDown={(event) => handleCardKeyDown(event, plan.tier)}
                    className={`premium-card-hover relative flex h-[548px] w-[78vw] max-w-[286px] shrink-0 snap-center cursor-pointer flex-col overflow-hidden rounded-[24px] border p-3.5 outline-none transition-colors duration-300 sm:h-[528px] sm:w-auto sm:max-w-none ${
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
                      scale: isSelected ? 1.01 : plan.featured ? 1.004 : 1,
                      opacity: isSelected ? 1 : plan.featured ? 0.96 : 0.84,
                      y: 0,
                    }}
                    whileHover={{
                      scale: isSelected ? 1.01 : 1.006,
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
                    <div className="mb-2 flex min-h-[26px] items-center justify-between gap-2">
                      {isSelected ? (
                        <span className="rounded-full border border-primary/30 bg-primary/16 px-2.5 py-1 text-[10px] font-bold text-primary">
                          {t("common.selected")}
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      {plan.badgeKey ? (
                        <span className="rounded-full border border-amber-300/25 bg-amber-300/12 px-2.5 py-1 text-[10px] font-bold text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.12)]">
                          {t(plan.badgeKey)}
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>

                    <div className="mb-3 flex items-start gap-2.5">
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
                        key={`${plan.tier}-${billing}-${appliedCouponCode ?? "none"}`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.14 }}
                        className="mb-3 min-h-[126px]"
                      >
                        {hasCouponDiscount && (
                          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/34">
                            <BadgePercent className="h-3.5 w-3.5 text-primary/70" />
                            <span className="line-through">{formatPrice(price.basePrice, language)}</span>
                            <span className="text-primary/80">%{price.couponPercentOff}</span>
                          </p>
                        )}
                        <p className="flex items-baseline gap-1.5">
                          <span className="text-[30px] font-black leading-none tracking-tight text-white sm:text-[31px]">
                            {formatPrice(price.finalPrice, language)}
                          </span>
                          <span className="text-[13px] font-medium text-white/38">
                            {billing === "monthly" ? t("pricing.perMonth") : t("pricing.perYear")}
                          </span>
                        </p>
                        <p className="mt-1 h-8 text-[11px] font-semibold leading-snug text-primary/72">
                          {billing === "yearly" && isPaid
                            ? t("pricing.yearlyEquivalent", {
                                price: formatPrice(monthlyEquivalent, language),
                              })
                            : t(plan.footnoteKey)}
                        </p>
                        <div
                          className={`mt-2 min-h-[52px] rounded-xl border border-white/8 bg-black/15 p-1.5 transition-opacity ${
                            isPaid ? "opacity-100" : "pointer-events-none invisible opacity-0"
                          }`}
                          aria-hidden={!isPaid}
                        >
                            <div className="flex items-center gap-1.5">
                              <BadgePercent className="h-3.5 w-3.5 shrink-0 text-primary/72" />
                              <input
                                value={couponInput}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.stopPropagation();
                                    handleApplyCoupon();
                                  }
                                }}
                                placeholder={t("pricing.couponMiniPlaceholder")}
                                className="h-6 min-w-0 flex-1 bg-transparent text-[10.5px] font-bold uppercase tracking-[0.08em] text-white outline-none placeholder:text-white/28"
                              />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleApplyCoupon();
                                }}
                                className="h-6 rounded-lg bg-primary/18 px-2 text-[10px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                              >
                                {t("pricing.applyCoupon")}
                              </button>
                            </div>
                            <p
                              className={`mt-1 h-3 truncate text-[10px] font-medium ${
                                couponFeedback?.type === "success"
                                  ? "text-primary/84"
                                  : "text-rose-200/82"
                              }`}
                            >
                              {couponFeedback?.message ?? ""}
                            </p>
                          </div>
                      </motion.div>
                    </AnimatePresence>

                    <div className="mb-3 flex-1 space-y-1.5 overflow-hidden">
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
          </div>
        </section>

        <p className="flex items-center justify-center gap-2 pb-5 text-center text-[12px] leading-relaxed text-white/36">
          <Smartphone className="h-4 w-4 text-primary/45" />
          {t("pricing.storePaymentNote")}
        </p>
      </main>
    </div>
  );
}
