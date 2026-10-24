"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/primitives";

import { createInvite, saveAiControls, saveSignupSettings, type AdminState } from "./actions";

function Status({ state }: { state: AdminState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-sm text-approve-fg" : "text-sm text-danger-fg"}>
      {state.message}
    </p>
  );
}

export function SignupSettingsForm({ mode, maxOrgs }: { mode: string; maxOrgs: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveSignupSettings, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signupMode">Sign-up mode</Label>
          <Select
            id="signupMode"
            name="signupMode"
            defaultValue={mode}
            options={[
              { value: "invite", label: "Invite only" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxOrgs">Maximum businesses</Label>
          <Input id="maxOrgs" name="maxOrgs" type="number" min={0} defaultValue={maxOrgs} />
        </div>
      </div>
      <Status state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        Save
      </Button>
    </form>
  );
}

export function CreateInviteForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createInvite, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Code (blank = random)</Label>
          <Input id="code" name="code" autoCapitalize="characters" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxUses">Uses</Label>
          <Input id="maxUses" name="maxUses" type="number" min={1} defaultValue={1} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="market">Country</Label>
          <Select
            id="market"
            name="market"
            defaultValue="ANY"
            options={[
              { value: "ANY", label: "Any" },
              { value: "UK", label: "UK" },
              { value: "NG", label: "Nigeria" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expiresInDays">Expires in days (0 = never)</Label>
          <Input id="expiresInDays" name="expiresInDays" type="number" min={0} defaultValue={30} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" placeholder="Who is it for?" />
        </div>
      </div>
      <Status state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        Create invite
      </Button>
    </form>
  );
}

export function AiControlsForm({ killSwitch, budget }: { killSwitch: boolean; budget: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveAiControls, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="killSwitch">AI generation</Label>
          <Select
            id="killSwitch"
            name="killSwitch"
            defaultValue={killSwitch ? "on" : "off"}
            options={[
              { value: "off", label: "Running" },
              { value: "on", label: "Paused (kill switch on)" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget">Daily AI budget (USD)</Label>
          <Input id="budget" name="budget" type="number" min={0} step="0.5" defaultValue={budget} />
        </div>
      </div>
      <Status state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        Save
      </Button>
    </form>
  );
}
