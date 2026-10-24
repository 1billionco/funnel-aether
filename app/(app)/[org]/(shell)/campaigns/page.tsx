import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Campaigns" };

export default function CampaignsPage() {
  return (
    <ComingSoon title="Campaigns">
      Email sequences to people who&apos;ve agreed to hear from you. You approve every step before
      anything is sent.
    </ComingSoon>
  );
}
