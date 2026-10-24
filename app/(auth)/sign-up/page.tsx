import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { NotConfigured } from "@/components/app/not-configured";
import { getUser } from "@/lib/auth/session";
import { getSignupMode } from "@/lib/auth/signup-mode";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const mode = await getSignupMode();
  if (!mode) return <NotConfigured />;
  if (await getUser()) redirect("/auth/continue");

  if (mode === "closed") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl">We&apos;re not taking sign-ups right now</h1>
        <p className="text-muted">
          The beta is full for the moment. Leave your email on the waitlist and we&apos;ll invite
          you as soon as there&apos;s room.
        </p>
        <Link
          href="/waitlist"
          className="font-medium text-primary-fg underline-offset-4 hover:underline"
        >
          Join the waitlist
        </Link>
      </div>
    );
  }

  const error = typeof params.error === "string" ? params.error : undefined;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Create your account</h1>
        <p className="mt-1 text-muted">
          Set up your brand in about five minutes. AI drafts your marketing; you approve everything
          before it goes out.
        </p>
      </div>
      <AuthForm mode="sign-up" inviteRequired={mode === "invite"} initialError={error} />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-primary-fg underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
