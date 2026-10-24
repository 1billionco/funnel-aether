"use client";

import * as React from "react";
import { useActionState } from "react";
import { Mail, KeyRound } from "lucide-react";

import {
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";
type Method = "link" | "password";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-danger-fg">
      {message}
    </p>
  );
}

export function AuthForm({
  mode,
  next,
  inviteRequired,
  initialError,
}: {
  mode: Mode;
  next?: string;
  inviteRequired: boolean;
  initialError?: string;
}) {
  const [method, setMethod] = React.useState<Method>("link");
  const action =
    method === "link"
      ? sendMagicLink
      : mode === "sign-in"
        ? signInWithPassword
        : signUpWithPassword;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {
    message: initialError,
  });
  const [invite, setInvite] = React.useState("");

  if (state.ok && method === "link") {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-6">
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary-tint text-primary-fg">
          <Mail className="size-5" />
        </div>
        <h2 className="font-display text-xl">Check your inbox</h2>
        <p className="mt-2 text-muted">{state.message}</p>
        <Button variant="link" className="mt-4" onClick={() => window.location.reload()}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="inviteCode" value={invite} />
        <Button type="submit" variant="outline" className="w-full">
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path
              fill="#4285F4"
              d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-2 3.2-4.8 3.2-8.2z"
            />
            <path
              fill="#34A853"
              d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z"
            />
            <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10z" />
            <path
              fill="#EA4335"
              d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"
            />
          </svg>
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or with your email{" "}
        <span className="h-px flex-1 bg-line" />
      </div>

      <div
        role="tablist"
        aria-label="Sign-in method"
        className="grid grid-cols-2 rounded-input border border-line bg-surface p-0.5"
      >
        {(
          [
            ["link", "Email link", <Mail key="m" />],
            ["password", "Password", <KeyRound key="k" />],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] text-sm text-muted [&_svg]:size-4",
              method === value && "bg-primary-tint text-primary-fg",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next ?? ""} />

        {mode === "sign-up" && method === "password" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Your name</Label>
            <Input id="fullName" name="fullName" autoComplete="name" />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={state.email}
            aria-invalid={!!state.errors?.email}
            aria-describedby={state.errors?.email ? "email-error" : undefined}
            required
          />
          <FieldError id="email-error" message={state.errors?.email} />
        </div>

        {method === "password" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              aria-invalid={!!state.errors?.password}
              aria-describedby={state.errors?.password ? "password-error" : undefined}
              required
            />
            <FieldError id="password-error" message={state.errors?.password} />
          </div>
        ) : null}

        {mode === "sign-up" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inviteCode">Invite code{inviteRequired ? "" : " (optional)"}</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              autoCapitalize="characters"
              autoComplete="off"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              aria-invalid={!!state.errors?.inviteCode}
              aria-describedby={state.errors?.inviteCode ? "invite-error" : "invite-hint"}
              required={inviteRequired}
            />
            {state.errors?.inviteCode ? (
              <FieldError id="invite-error" message={state.errors.inviteCode} />
            ) : (
              <p id="invite-hint" className="text-sm text-muted">
                We&apos;re in a small beta. Your code is in your invite email.
              </p>
            )}
          </div>
        ) : null}

        {state.message && !state.ok ? (
          <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-sm text-danger-fg">
            {state.message}
          </p>
        ) : null}
        {state.message && state.ok ? (
          <p
            role="status"
            className="rounded-input bg-primary-tint px-3 py-2 text-sm text-primary-fg"
          >
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? "Please wait…"
            : method === "link"
              ? "Email me a sign-in link"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
        </Button>
      </form>
    </div>
  );
}
