import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { requireOrg } from "@/lib/auth/session";
import { planName } from "@/lib/credits/plans";

export const metadata: Metadata = { title: "Plan & credits" };

export default async function BillingPage({ params }: PageProps<"/[org]/billing">) {
  const { org } = await requireOrg((await params).org);
  return (
    <ComingSoon title="Plan & credits">
      You&apos;re on the <strong>{planName(org.plan)}</strong> plan. Upgrades, payments (card in the
      UK, Paystack in Nigeria) and credit packs arrive in a later update.
    </ComingSoon>
  );
}
