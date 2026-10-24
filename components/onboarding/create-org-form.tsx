"use client";

import { useActionState } from "react";

import { createOrganization, type CreateOrgState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const MARKETS = [
  { value: "UK", title: "United Kingdom", detail: "Prices in pounds (£). British English." },
  { value: "NG", title: "Nigeria", detail: "Prices in naira (₦). Lite mode on for slower data." },
] as const;

export function CreateOrgForm({ askForInvite }: { askForInvite: boolean }) {
  const [state, action, pending] = useActionState<CreateOrgState, FormData>(createOrganization, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Where is your business based?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MARKETS.map((m) => (
            <label
              key={m.value}
              className={cn(
                "flex min-h-11 cursor-pointer gap-3 rounded-card border border-line bg-surface p-4 transition-colors",
                "has-[:checked]:border-primary has-[:checked]:bg-primary-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
              )}
            >
              <input
                type="radio"
                name="market"
                value={m.value}
                className="mt-1 size-4 accent-[var(--primary)]"
                required
              />
              <span>
                <span className="block font-medium">{m.title}</span>
                <span className="block text-sm text-muted">{m.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {state.errors?.market ? (
          <p className="text-sm text-danger-fg">{state.errors.market}</p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="organization"
          aria-invalid={!!state.errors?.name}
          aria-describedby={state.errors?.name ? "name-error" : undefined}
          required
        />
        {state.errors?.name ? (
          <p id="name-error" className="text-sm text-danger-fg">
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="industry">What kind of business is it? (optional)</Label>
        <Input
          id="industry"
          name="industry"
          placeholder="e.g. accountancy practice, electronics shop"
        />
      </div>

      {askForInvite || state.errors?.inviteCode ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inviteCode">Invite code</Label>
          <Input
            id="inviteCode"
            name="inviteCode"
            autoCapitalize="characters"
            aria-invalid={!!state.errors?.inviteCode}
            aria-describedby={state.errors?.inviteCode ? "invite-error" : undefined}
          />
          {state.errors?.inviteCode ? (
            <p id="invite-error" className="text-sm text-danger-fg">
              {state.errors.inviteCode}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.message ? (
        <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-sm text-danger-fg">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:self-end">
        {pending ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}
