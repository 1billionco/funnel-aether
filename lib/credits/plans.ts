/**
 * Plans and entitlements as config (spec §5). Every gated feature asks
 * can(org, feature) or limit(org, key); no plan checks scattered in code.
 * Prices are the spec's validation-build prices; credit-pack prices are
 * placeholders Joshua sets (null = not on sale yet).
 */
export type PlanId = "free" | "growth" | "advanced";
export type Market = "UK" | "NG";

export type Feature =
  | "smart_model"
  | "multi_brand"
  | "lead_scoring"
  | "social_assets"
  | "whatsapp_assets"
  | "email_campaigns"
  | "attribution"
  | "cohorts"
  | "team_seats"
  | "onboarding_webinar"
  | "strategist_review"
  | "credit_packs"
  | "custom_scoring_weights";

export type LimitKey =
  | "brands"
  | "contacts"
  | "monthly_credits_milli"
  | "daily_generations"
  | "analytics_days"
  | "active_sequences"
  | "steps_per_sequence"
  | "seats"
  | "monthly_email_sends";

const UNLIMITED = Number.POSITIVE_INFINITY;

interface PlanConfig {
  name: string;
  price: Record<Market, number>;
  limits: Record<LimitKey, number | Record<Market, number>>;
  features: Feature[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    name: "Free Starter",
    price: { UK: 0, NG: 0 },
    limits: {
      brands: 1,
      contacts: 100,
      monthly_credits_milli: { UK: 15_000, NG: 10_000 },
      daily_generations: 5,
      analytics_days: 7,
      active_sequences: 1,
      steps_per_sequence: 2,
      seats: 1,
      monthly_email_sends: 100,
    },
    // Free gets ONE channel: email or WhatsApp assets (chosen per org, enforced in M5).
    features: ["whatsapp_assets", "email_campaigns"],
  },
  growth: {
    name: "Growth",
    price: { UK: 29, NG: 15_000 },
    limits: {
      brands: 3,
      contacts: 2_500,
      monthly_credits_milli: 250_000,
      daily_generations: UNLIMITED,
      analytics_days: 365,
      active_sequences: 5,
      steps_per_sequence: UNLIMITED,
      seats: 1,
      monthly_email_sends: UNLIMITED,
    },
    features: [
      "smart_model",
      "multi_brand",
      "lead_scoring",
      "social_assets",
      "whatsapp_assets",
      "email_campaigns",
      "onboarding_webinar",
      "credit_packs",
    ],
  },
  advanced: {
    name: "Advanced",
    price: { UK: 79, NG: 25_000 },
    limits: {
      brands: 10,
      contacts: 10_000,
      monthly_credits_milli: 1_000_000,
      daily_generations: UNLIMITED,
      analytics_days: 365,
      active_sequences: UNLIMITED,
      steps_per_sequence: UNLIMITED,
      seats: 3,
      monthly_email_sends: UNLIMITED,
    },
    features: [
      "smart_model",
      "multi_brand",
      "lead_scoring",
      "social_assets",
      "whatsapp_assets",
      "email_campaigns",
      "attribution",
      "cohorts",
      "team_seats",
      "onboarding_webinar",
      "strategist_review",
      "credit_packs",
      "custom_scoring_weights",
    ],
  },
};

/** NG pay-as-you-go packs (spec §5). Prices are set by Joshua; null = hidden. */
export const CREDIT_PACKS: { id: string; credits: number; priceNgn: number | null }[] = [
  { id: "ng-50", credits: 50, priceNgn: null },
  { id: "ng-150", credits: 150, priceNgn: null },
];

export interface PlanSubject {
  plan: PlanId;
  market: Market;
}

export function can(org: PlanSubject, feature: Feature): boolean {
  return PLANS[org.plan].features.includes(feature);
}

export function limit(org: PlanSubject, key: LimitKey): number {
  const v = PLANS[org.plan].limits[key];
  return typeof v === "number" ? v : v[org.market];
}

export function planName(plan: PlanId) {
  return PLANS[plan].name;
}

export function planPrice(org: PlanSubject) {
  return PLANS[org.plan].price[org.market];
}
