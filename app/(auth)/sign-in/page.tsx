import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { NotConfigured } from "@/components/app/not-configured";
import { friendlyError } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getUser } from "@/lib/auth/session";
import { services } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_expired: "That sign-in link has expired or was already used. Request a new one.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  const errorParam = typeof params.error === "string" ? params.error : undefined;
  if (services().database !== "live") return <NotConfigured />;
  if (await getUser()) redirect(next || "/auth/continue");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Welcome back</h1>
        <p className="mt-1 text-muted">Sign in to review your drafts and leads.</p>
      </div>
      <AuthForm
        mode="sign-in"
        next={next}
        inviteRequired={false}
        initialError={errorParam ? (ERRORS[errorParam] ?? friendlyError(errorParam)) : undefined}
      />
      <p className="text-sm text-muted">
        New here?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-primary-fg underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
