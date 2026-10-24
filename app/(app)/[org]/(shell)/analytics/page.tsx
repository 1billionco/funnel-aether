import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ComingSoon title="Analytics">
      A plain-English weekly summary of what you published, who filled in your forms, and which
      campaigns brought customers.
    </ComingSoon>
  );
}
