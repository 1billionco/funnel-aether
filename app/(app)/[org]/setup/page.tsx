import { redirect } from "next/navigation";

import { requireOrg } from "@/lib/auth/session";
import { SETUP_STEPS } from "@/lib/onboarding/steps";

export default async function SetupIndex({ params }: PageProps<"/[org]/setup">) {
  const { org: slug } = await params;
  const { org, db, user } = await requireOrg(slug);
  if (org.onboarding_completed_at) redirect(`/${slug}/today`);
  const { data: profile } = await db
    .from("profiles")
    .select("onboarding_state")
    .eq("user_id", user.id)
    .maybeSingle();
  const saved = (profile?.onboarding_state as { org_id?: string; step?: string } | null) ?? {};
  const step =
    saved.org_id === org.id && SETUP_STEPS.some((s) => s.id === saved.step) ? saved.step : "brand";
  redirect(`/${slug}/setup/${step}`);
}
