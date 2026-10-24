"use client";

import { useActionState, useTransition } from "react";

import {
  saveOrganization,
  saveProfile,
  type SettingsState,
} from "@/app/(app)/[org]/_actions/settings";
import { setLiteMode } from "@/app/(app)/[org]/_actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Switch } from "@/components/ui/primitives";

function Status({ state }: { state: SettingsState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? "text-sm text-approve-fg" : "text-sm text-danger-fg"}
    >
      {state.message}
    </p>
  );
}

export function ProfileForm({
  slug,
  fullName,
  email,
}: {
  slug: string;
  fullName: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveProfile.bind(null, slug),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" />
      </div>
      <p className="text-sm text-muted">Signed in as {email}</p>
      <Status state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        Save
      </Button>
    </form>
  );
}

export function OrganizationForm({
  slug,
  org,
  timezones,
  isOwner,
}: {
  slug: string;
  org: {
    name: string;
    timezone: string;
    market: "UK" | "NG";
    market_locked: boolean;
    business_address: string | null;
  };
  timezones: string[];
  isOwner: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveOrganization.bind(null, slug),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset disabled={!isOwner} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-name">Business name</Label>
          <Input id="org-name" name="name" defaultValue={org.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-market">Country</Label>
          <Select
            id="org-market"
            name="market"
            defaultValue={org.market}
            disabled={org.market_locked || !isOwner}
            options={[
              { value: "UK", label: "United Kingdom (GBP)" },
              { value: "NG", label: "Nigeria (NGN)" },
            ]}
          />
          <p className="text-sm text-muted">
            {org.market_locked
              ? "Locked after your first payment."
              : "You can change this until your first payment."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-tz">Timezone</Label>
          <Select
            id="org-tz"
            name="timezone"
            defaultValue={org.timezone}
            options={timezones.map((t) => ({ value: t, label: t.replaceAll("_", " ") }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-address">Business address</Label>
          <Input
            id="org-address"
            name="businessAddress"
            defaultValue={org.business_address ?? ""}
            aria-describedby="addr-hint"
          />
          <p id="addr-hint" className="text-sm text-muted">
            UK law requires it in marketing emails. We add it to the footer.
          </p>
        </div>
      </fieldset>
      <Status state={state} />
      {isOwner ? (
        <Button type="submit" variant="outline" disabled={pending} className="self-start">
          Save
        </Button>
      ) : (
        <p className="text-sm text-muted">Only the owner can change these.</p>
      )}
    </form>
  );
}

export function LiteModeToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div>
        <Label htmlFor="lite-toggle">Lite mode</Label>
        <p className="text-sm text-muted">
          Faster on slow data: no web fonts, no charts, shorter lists.
        </p>
      </div>
      <Switch
        id="lite-toggle"
        checked={on}
        disabled={pending}
        onCheckedChange={(v) => start(() => setLiteMode(v))}
      />
    </div>
  );
}
