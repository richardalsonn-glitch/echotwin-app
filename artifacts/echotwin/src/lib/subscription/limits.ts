export type SubscriptionTier = "free" | "basic" | "full";

export interface TierLimits {
  maxPersonas: number;
  maxMessagesPerMonth: number;
  canUploadAvatar: boolean;
  canEditDisplayName: boolean;
  canDeletePersona: boolean;
  canAddNewPersona: boolean;
  canUploadVoice: boolean;
  hasRelationshipAnalysis: boolean;
  hasSoundAnalysis: boolean;
  hasVoiceMessaging: boolean;
  canExport: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxPersonas: 1,
    maxMessagesPerMonth: 5,
    canUploadAvatar: true,
    canEditDisplayName: false,
    canDeletePersona: false,
    canAddNewPersona: false,
    canUploadVoice: false,
    hasRelationshipAnalysis: false,
    hasSoundAnalysis: false,
    hasVoiceMessaging: false,
    canExport: false,
  },
  basic: {
    maxPersonas: 2,
    maxMessagesPerMonth: 100,
    canUploadAvatar: true,
    canEditDisplayName: true,
    canDeletePersona: true,
    canAddNewPersona: true,
    canUploadVoice: false,
    hasRelationshipAnalysis: true,
    hasSoundAnalysis: false,
    hasVoiceMessaging: false,
    canExport: false,
  },
  full: {
    maxPersonas: Infinity,
    maxMessagesPerMonth: Infinity,
    canUploadAvatar: true,
    canEditDisplayName: true,
    canDeletePersona: true,
    canAddNewPersona: true,
    canUploadVoice: true,
    hasRelationshipAnalysis: true,
    hasSoundAnalysis: true,
    hasVoiceMessaging: true,
    canExport: true,
  },
};

export const TIER_PRICES = {
  basic: {
    monthly: 29.99,
    yearly: 26.99,
    label: "Temel",
    currency: "TRY",
  },
  full: {
    monthly: 49.99,
    yearly: 44.99,
    label: "Full",
    currency: "TRY",
  },
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
          ? `Ücretsiz planda yalnızca ${limits.maxMessagesPerMonth} mesaj hakkın var. Premium'a geç!`
          : `Bu ay mesaj limitine ulaştın (${limits.maxMessagesPerMonth}).`,
    };
  }
  return { allowed: true };
}
