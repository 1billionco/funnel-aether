import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <ComingSoon title="Create">
      Write posts, emails and WhatsApp messages in your brand voice.
    </ComingSoon>
  );
}
