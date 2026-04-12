export type SubscriptionTier = "free" | "basic" | "full";

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}
