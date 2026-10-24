import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/app/wordmark";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";
import { Progress } from "@/components/ui/primitives";
import { INVITE_COOKIE } from "@/lib/auth/invite-cookie";
import { getMemberships, requireUser } from "@/lib/auth/session";
import { getSignupMode } from "@/lib/auth/signup-mode";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const first = (await getMemberships())[0]?.organizations;
  if (first)
    redirect(first.onboarding_completed_at ? `/${first.slug}/today` : `/${first.slug}/setup`);

  const mode = await getSignupMode();
  const hasInvite = !!(await cookies()).get(INVITE_COOKIE)?.value;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-5 md:px-8">
        <Wordmark />
        <span className="text-sm text-muted">About 5 minutes</span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-16">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Step 1 of 5 · Your business</p>
          <Progress value={10} aria-label="Onboarding progress" />
        </div>
        <div>
          <h1 className="font-display text-2xl">Let&apos;s set up your business</h1>
          <p className="mt-1 text-muted">
            This sets your currency and how we write for you. You can change your country until your
            first payment.
          </p>
        </div>
        <CreateOrgForm askForInvite={mode === "invite" && !hasInvite} />
      </main>
    </div>
  );
}
