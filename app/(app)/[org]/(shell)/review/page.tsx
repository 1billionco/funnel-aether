import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <ComingSoon title="Review">
      Every AI draft lands here for you to approve, edit or reject.
    </ComingSoon>
  );
}
