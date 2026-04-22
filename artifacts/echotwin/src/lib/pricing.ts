import type { SubscriptionTier } from "@/types/subscription";

export type BillingCycle = "monthly" | "yearly";
export type PaidTier = "basic" | "full";
export type PricingTier = SubscriptionTier;

export type PricingCoupon = {
  code: string;
  percentOff: number;
  cycles: BillingCycle[];
  description: string;
};

export type CouponValidationResult =
  | { ok: true; coupon: PricingCoupon; effectivePercentOff: number }
  | { ok: false; reason: "empty" | "invalid" | "monthly_only" | "yearly_only" };

export const YEARLY_DISCOUNT_RATE = 0.1;

export const MONTHLY_PLAN_PRICES: Record<PricingTier, number> = {
  free: 0,
  basic: 49.99,
  full: 89.99,
};

export const PRICING_COUPONS: PricingCoupon[] = [
  {
    code: "HOSGELDIN5",
    percentOff: 5,
    cycles: ["monthly"],
    description: "Aylik planda %5 indirim",
  },
  {
    code: "ILKADIM3",
    percentOff: 3,
    cycles: ["monthly"],
    description: "Aylik planda %3 indirim",
  },
  {
    code: "SADIK1",
    percentOff: 1,
    cycles: ["yearly"],
    description: "Yillik planda %1 ek indirim",
  },
];

export const STORE_BILLING_PROVIDERS = {
  ios: "app_store_in_app_purchase",
  android: "google_play_billing",
} as const;

const MAX_COUPON_DISCOUNT: Record<BillingCycle, number> = {
  monthly: 5,
  yearly: 1,
};

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function findPricingCoupon(code: string): PricingCoupon | null {
  const normalized = normalizeCouponCode(code);
  return PRICING_COUPONS.find((coupon) => coupon.code === normalized) ?? null;
}

export function validatePricingCoupon(
  code: string,
  cycle: BillingCycle
): CouponValidationResult {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { ok: false, reason: "empty" };

  const coupon = findPricingCoupon(normalized);
  if (!coupon) return { ok: false, reason: "invalid" };

  if (!coupon.cycles.includes(cycle)) {
    return {
      ok: false,
      reason: coupon.cycles.includes("monthly") ? "monthly_only" : "yearly_only",
    };
  }

  return {
    ok: true,
    coupon,
    effectivePercentOff: Math.min(coupon.percentOff, MAX_COUPON_DISCOUNT[cycle]),
  };
}

export function getBasePlanPrice(tier: PricingTier, cycle: BillingCycle): number {
  const monthlyPrice = MONTHLY_PLAN_PRICES[tier];
  if (tier === "free") return 0;
  if (cycle === "monthly") return monthlyPrice;
  return roundCurrency(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT_RATE));
}

export function getMonthlyEquivalentPrice(tier: PricingTier, cycle: BillingCycle): number {
  const basePrice = getBasePlanPrice(tier, cycle);
  return cycle === "yearly" ? roundCurrency(basePrice / 12) : basePrice;
}

export function getDiscountedPlanPrice(params: {
  tier: PricingTier;
  cycle: BillingCycle;
  couponCode?: string | null;
}): { basePrice: number; finalPrice: number; couponPercentOff: number } {
  const basePrice = getBasePlanPrice(params.tier, params.cycle);
  if (params.tier === "free" || !params.couponCode) {
    return { basePrice, finalPrice: basePrice, couponPercentOff: 0 };
  }

  const validation = validatePricingCoupon(params.couponCode, params.cycle);
  if (!validation.ok) {
    return { basePrice, finalPrice: basePrice, couponPercentOff: 0 };
  }

  const finalPrice = roundCurrency(basePrice * (1 - validation.effectivePercentOff / 100));
  return {
    basePrice,
    finalPrice,
    couponPercentOff: validation.effectivePercentOff,
  };
}

export function createStoreBillingPayload(params: {
  tier: PaidTier;
  cycle: BillingCycle;
  couponCode?: string | null;
}) {
  return {
    tier: params.tier,
    cycle: params.cycle,
    couponCode: params.couponCode ? normalizeCouponCode(params.couponCode) : null,
    providers: STORE_BILLING_PROVIDERS,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
