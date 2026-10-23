/**
 * Payment provider abstraction (spec §2). Stripe = GBP / UK orgs, Paystack = NGN / NG orgs.
 * Test mode by default. We store provider IDs only — never card or bank details.
 */
export type PlanId = "free" | "growth" | "advanced";

export interface CheckoutRequest {
  orgId: string;
  plan: Exclude<PlanId, "free">;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreditPackRequest {
  orgId: string;
  packId: string;
  customerEmail: string;
  successUrl: string;
}

export interface PaymentProvider {
  readonly name: "stripe" | "paystack" | "mock";
  readonly currency: "GBP" | "NGN";
  readonly isTestMode: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  createCreditPackCheckout?(req: CreditPackRequest): Promise<{ url: string }>;
  manageUrl(orgId: string, returnUrl: string): Promise<{ url: string } | null>;
  /** Verifies the signature; throws on mismatch. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<unknown>;
}
