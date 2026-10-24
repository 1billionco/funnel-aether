"use client";

import * as React from "react";
import { useActionState } from "react";

import type { BrandFormState } from "@/app/(app)/[org]/_actions/brand";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Slider } from "@/components/ui/primitives";
import { TONE_SLIDERS, type ToneSliders } from "@/lib/validation/org";

export interface BrandValues {
  offer: string | null;
  audience: string | null;
  industry: string | null;
  tone_sliders: ToneSliders;
  do_say: string[];
  dont_say: string[];
  compliance_rules: string[];
  example_ctas: string[];
  website_url: string | null;
  whatsapp_number: string | null;
}

function Hint({ id, error, children }: { id: string; error?: string; children?: React.ReactNode }) {
  if (error)
    return (
      <p id={id} className="text-sm text-danger-fg">
        {error}
      </p>
    );
  if (!children) return null;
  return (
    <p id={id} className="text-sm text-muted">
      {children}
    </p>
  );
}

function ToneSlider({
  name,
  left,
  right,
  initial,
}: {
  name: string;
  left: string;
  right: string;
  initial: number;
}) {
  const [value, setValue] = React.useState([initial]);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className={value[0]! < 45 ? "font-medium" : "text-muted"}>{left}</span>
        <span className={value[0]! > 55 ? "font-medium" : "text-muted"}>{right}</span>
      </div>
      <Slider
        value={value}
        onValueChange={setValue}
        min={0}
        max={100}
        step={5}
        aria-label={`${left} to ${right}`}
      />
      <input type="hidden" name={name} value={value[0]} />
    </div>
  );
}

export function QuestionnaireForm({
  action,
  brand,
  market,
  submitLabel,
  secondary,
}: {
  action: (prev: BrandFormState, formData: FormData) => Promise<BrandFormState>;
  brand: BrandValues;
  market: "UK" | "NG";
  submitLabel: string;
  secondary?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<BrandFormState, FormData>(action, {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="offer">What do you sell?</Label>
        <Textarea
          id="offer"
          name="offer"
          defaultValue={brand.offer ?? ""}
          className="min-h-20"
          placeholder={
            market === "NG"
              ? "e.g. phones, TVs and home appliances, with delivery across Lagos"
              : "e.g. accounts, tax returns and payroll for small businesses"
          }
          aria-invalid={!!e.offer}
          aria-describedby="offer-hint"
        />
        <Hint id="offer-hint" error={e.offer} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audience">Who are your customers?</Label>
        <Textarea
          id="audience"
          name="audience"
          defaultValue={brand.audience ?? ""}
          className="min-h-20"
          placeholder={
            market === "NG"
              ? "e.g. young families and small shop owners in Lagos"
              : "e.g. owners of small firms in the South East who hate paperwork"
          }
          aria-invalid={!!e.audience}
          aria-describedby="audience-hint"
        />
        <Hint id="audience-hint" error={e.audience} />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">How should you sound?</legend>
        {TONE_SLIDERS.map((s) => (
          <ToneSlider
            key={s.key}
            name={`tone.${s.key}`}
            left={s.left}
            right={s.right}
            initial={brand.tone_sliders[s.key] ?? 50}
          />
        ))}
      </fieldset>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doSay">Words and phrases to use</Label>
          <Textarea
            id="doSay"
            name="doSay"
            defaultValue={brand.do_say.join(", ")}
            className="min-h-20"
            aria-describedby="doSay-hint"
          />
          <Hint id="doSay-hint" error={e.doSay}>
            Separate with commas.
          </Hint>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dontSay">Words to avoid</Label>
          <Textarea
            id="dontSay"
            name="dontSay"
            defaultValue={brand.dont_say.join(", ")}
            className="min-h-20"
            aria-describedby="dontSay-hint"
          />
          <Hint id="dontSay-hint" error={e.dontSay}>
            We&apos;ll flag drafts that use these.
          </Hint>
        </div>
      </div>

      <details className="rounded-card border border-line bg-surface p-4 [&_summary]:cursor-pointer">
        <summary className="font-medium">More detail (optional)</summary>
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" name="industry" defaultValue={brand.industry ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exampleCtas">Calls to action you like</Label>
            <Input
              id="exampleCtas"
              name="exampleCtas"
              defaultValue={brand.example_ctas.join(", ")}
              placeholder="Book a free call, Send us a WhatsApp"
              aria-describedby="ctas-hint"
            />
            <Hint id="ctas-hint" error={e.exampleCtas}>
              Separate with commas.
            </Hint>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="complianceRules">Rules we must always follow</Label>
            <Textarea
              id="complianceRules"
              name="complianceRules"
              defaultValue={brand.compliance_rules.join("\n")}
              className="min-h-20"
              placeholder={
                market === "UK"
                  ? "e.g. Never promise a specific tax saving"
                  : "e.g. Always say prices may change"
              }
              aria-describedby="rules-hint"
            />
            <Hint id="rules-hint" error={e.complianceRules}>
              One per line.
            </Hint>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="websiteUrl">Website</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              inputMode="url"
              defaultValue={brand.website_url ?? ""}
              aria-invalid={!!e.websiteUrl}
              aria-describedby="web-hint"
            />
            <Hint id="web-hint" error={e.websiteUrl} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappNumber">WhatsApp number for customers</Label>
            <Input
              id="whatsappNumber"
              name="whatsappNumber"
              inputMode="tel"
              defaultValue={brand.whatsapp_number ?? ""}
              placeholder={market === "NG" ? "+234 803 000 0000" : "+44 7700 900000"}
              aria-invalid={!!e.whatsappNumber}
              aria-describedby="wa-hint"
            />
            <Hint id="wa-hint" error={e.whatsappNumber}>
              Used for click-to-chat links in your posts and forms.
            </Hint>
          </div>
        </div>
      </details>

      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "text-sm text-approve-fg"
              : "rounded-input bg-danger/10 px-3 py-2 text-sm text-danger-fg"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {secondary}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
