export type SubscriptionTier = "free" | "basic" | "full";

export interface TierLimits {
  maxPersonas: number;
  maxMessagesPerMonth: number;
  aiModel: "gpt-5-mini" | "gpt-5.2";
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { maxPersonas: 1, maxMessagesPerMonth: 5, aiModel: "gpt-5-mini" },
  basic: { maxPersonas: 2, maxMessagesPerMonth: 100, aiModel: "gpt-5-mini" },
  full: { maxPersonas: Infinity, maxMessagesPerMonth: Infinity, aiModel: "gpt-5.2" },
};

export function getLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

export function canSendMessage(
  tier: SubscriptionTier,
  messageCountUsed: number
): { allowed: boolean; reason?: string } {
  const limits = getLimits(tier);
  if (messageCountUsed >= limits.maxMessagesPerMonth) {
    return {
      allowed: false,
      reason:
        tier === "free"
          ? `Ücretsiz planda yalnızca ${limits.maxMessagesPerMonth} mesaj hakkın var. Temel veya Full plana geç!`
          : `Bu ay mesaj limitine ulaştın (${limits.maxMessagesPerMonth}).`,
    };
  }
  return { allowed: true };
}
