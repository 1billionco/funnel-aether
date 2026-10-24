import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <ComingSoon title="Leads">
      Lead forms you can share or embed, scored leads with the reasons behind each score, and
      WhatsApp click-to-chat. This is the next part we&apos;re building.
    </ComingSoon>
  );
}
