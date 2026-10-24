"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Sparkles, Wallet } from "lucide-react";

import { chooseVariant } from "@/app/(app)/[org]/_actions/review";
import { ChannelPreview } from "@/components/drafts/channel-preview";
import { AiLabel, BrandMatchChip, FlagsList, MatchReasons } from "@/components/drafts/quality";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Metric } from "@/components/ui/misc";
import { Label, Select } from "@/components/ui/primitives";
import { CHANNEL_LABELS, OUTPUT_TYPES, type Channel, type OutputType } from "@/lib/ai/output-types";
import { formatCredits } from "@/lib/format";
import { useGeneration } from "@/lib/hooks/use-generation";
import type { Template } from "@/lib/templates";
import { cn } from "@/lib/utils";

export interface CreateStudioProps {
  slug: string;
  brandName: string;
  defaults: { offer: string; audience: string };
  templates: Template[];
  /** Typical milli-credits per type, indexed by versions − 1. */
  estimates: Record<OutputType, number[]>;
  balance: number;
  canGenerate: boolean;
  /** Onboarding: one preset template, compact layout, custom finish. */
  compact?: boolean;
  initialTemplateId?: string;
  onDone?: React.ReactNode;
}

const typeOptions = (Object.keys(OUTPUT_TYPES) as OutputType[]).map((t) => ({
  value: t,
  label: OUTPUT_TYPES[t].label,
}));

export function CreateStudio(props: CreateStudioProps) {
  const initial = props.templates.find((t) => t.id === props.initialTemplateId);
  const [type, setType] = React.useState<OutputType>(initial?.type ?? "social_post");
  const [channel, setChannel] = React.useState<Channel>(
    initial?.channel ?? OUTPUT_TYPES.social_post.channels[0]!,
  );
  const [goal, setGoal] = React.useState(initial?.goal ?? "");
  const [details, setDetails] = React.useState(initial?.details ?? "");
  const [offer, setOffer] = React.useState(props.defaults.offer);
  const [audience, setAudience] = React.useState(props.defaults.audience);
  const [variants, setVariants] = React.useState(OUTPUT_TYPES[type].defaultVariants);
  const [chosen, setChosen] = React.useState(0);
  const { state, generate, reset } = useGeneration(props.slug);
  const router = useRouter();

  const spec = OUTPUT_TYPES[type];
  const estimate = props.estimates[type][variants - 1] ?? props.estimates[type][0]!;
  const busy =
    state.phase === "starting" || state.phase === "streaming" || state.phase === "background";
  const notEnough = props.balance < estimate;

  function applyTemplate(t: Template) {
    setType(t.type);
    setChannel(t.channel);
    setGoal(t.goal);
    setDetails(t.details ?? "");
    setVariants(OUTPUT_TYPES[t.type].defaultVariants);
    reset();
  }

  function changeType(t: OutputType) {
    setType(t);
    if (!OUTPUT_TYPES[t].channels.includes(channel)) setChannel(OUTPUT_TYPES[t].channels[0]!);
    setVariants(OUTPUT_TYPES[t].defaultVariants);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChosen(0);
    await generate({
      type,
      channel,
      variants,
      brief: {
        goal,
        offer: offer || undefined,
        audience: audience || undefined,
        details: details || undefined,
      },
    });
    // Shell chrome (Review badge, credits meter) lives in a persistent layout: refresh it.
    router.refresh();
  }

  const shownVariants = state.variants.length ? state.variants : state.text ? [state.text] : [];

  return (
    <div className={cn("grid gap-6", !props.compact && "lg:grid-cols-[minmax(0,26rem)_1fr]")}>
      <div className="flex flex-col gap-6">
        {!props.compact ? (
          <section aria-labelledby="templates-title">
            <h2 id="templates-title" className="mb-3 text-sm font-medium text-muted">
              Start from a template
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {props.templates.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex h-full min-h-11 w-full flex-col items-start rounded-card border border-line bg-surface p-3 text-left text-sm transition-colors hover:border-primary/40"
                  >
                    <span className="font-medium">{t.title}</span>
                    <span className="text-xs text-muted">{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Brief">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="out-type">What are you making?</Label>
              <Select
                id="out-type"
                value={type}
                onValueChange={(v) => changeType(v as OutputType)}
                options={typeOptions}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="out-channel">Where will it go?</Label>
              <Select
                id="out-channel"
                value={channel}
                onValueChange={(v) => setChannel(v as Channel)}
                options={spec.channels.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief-goal">What should it achieve?</Label>
            <Textarea
              id="brief-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-20"
              placeholder="e.g. Get people to book a free call this month"
              required
            />
          </div>
          <details
            className="rounded-card border border-line bg-surface p-3 [&_summary]:cursor-pointer"
            open={!props.compact}
          >
            <summary className="text-sm font-medium">Offer, audience and details</summary>
            <div className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brief-offer">Offer or product</Label>
                <Input id="brief-offer" value={offer} onChange={(e) => setOffer(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brief-audience">Who is it for?</Label>
                <Input
                  id="brief-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brief-details">Anything else? (prices, dates, links)</Label>
                <Textarea
                  id="brief-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="min-h-16"
                />
              </div>
              {spec.maxVariants > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brief-variants">Versions to compare</Label>
                  <Select
                    id="brief-variants"
                    value={String(variants)}
                    onValueChange={(v) => setVariants(Number(v))}
                    options={Array.from({ length: spec.maxVariants }, (_, i) => ({
                      value: String(i + 1),
                      label: String(i + 1),
                    }))}
                  />
                </div>
              ) : null}
            </div>
          </details>

          <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Wallet className="size-4" aria-hidden />
              About{" "}
              <Metric className="text-ink" data-testid="credit-estimate">
                {formatCredits(estimate)}
              </Metric>{" "}
              credits · You have{" "}
              <Metric className="text-ink">{formatCredits(props.balance)}</Metric>
            </p>
            <Button
              type="submit"
              disabled={busy || !props.canGenerate || !goal.trim() || notEnough}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
              {busy ? "Writing…" : "Generate"}
            </Button>
          </div>
          {notEnough ? (
            <p role="alert" className="text-sm text-danger-fg">
              You don&apos;t have enough credits for this.{" "}
              <Link href={`/${props.slug}/billing`} className="underline underline-offset-4">
                Top up or upgrade
              </Link>
              .
            </p>
          ) : null}
          {!props.canGenerate ? (
            <p className="text-sm text-muted">Reviewers can approve drafts but not create them.</p>
          ) : null}
        </form>
      </div>

      <section
        aria-labelledby="output-title"
        aria-live="polite"
        className="flex min-w-0 flex-col gap-4"
      >
        <h2 id="output-title" className="sr-only">
          Output
        </h2>
        {state.phase === "idle" ? (
          <div className="rounded-card border border-dashed border-line p-8 text-center text-muted">
            <Sparkles className="mx-auto mb-2 size-5 text-primary-fg" aria-hidden />
            Your draft appears here. Nothing is published: every draft goes to Review for your
            approval.
          </div>
        ) : null}

        {state.phase === "error" ? (
          <div
            role="alert"
            className="rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-danger-fg"
          >
            {state.message}
            {state.errorCode === "insufficient_credits" || state.errorCode === "daily_cap" ? (
              <Link href={`/${props.slug}/billing`} className="ml-1 underline underline-offset-4">
                See plans and credits
              </Link>
            ) : null}
          </div>
        ) : null}

        {state.phase !== "idle" && state.phase !== "error" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <AiLabel isMock={state.isMock} />
              {state.phase === "background" ? (
                <Badge tone="info">Writing in the background…</Badge>
              ) : null}
              {state.escalating ? <Badge tone="info">Trying a stronger model…</Badge> : null}
              {state.phase === "done" ? (
                <BrandMatchChip
                  score={state.brandMatch?.score ?? null}
                  reasons={state.brandMatch?.reasons ?? []}
                />
              ) : null}
              {state.phase === "done" && state.millicredits !== undefined ? (
                <Badge tone="outline">
                  Used <Metric>{formatCredits(state.millicredits)}</Metric> credits
                </Badge>
              ) : null}
              {state.status === "partial" ? (
                <Badge tone="pending">Stopped early: finish it in Review</Badge>
              ) : null}
            </div>
            {state.phase === "done" ? <FlagsList flags={state.flags} /> : null}
            {state.phase === "done" && state.brandMatch ? (
              <MatchReasons reasons={state.brandMatch.reasons} />
            ) : null}

            <div className={cn("grid gap-4", shownVariants.length > 1 && "xl:grid-cols-2")}>
              {(shownVariants.length ? shownVariants : [""]).map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-2 rounded-card p-1",
                    state.phase === "done" &&
                      chosen === i &&
                      shownVariants.length > 1 &&
                      "ring-2 ring-primary",
                  )}
                >
                  {shownVariants.length > 1 ? (
                    <p className="px-1 text-sm font-medium">Version {i + 1}</p>
                  ) : null}
                  <ChannelPreview
                    draft={{ channel, body: v || "…", metadata: {} }}
                    brandName={props.brandName}
                  />
                  {state.phase === "done" && shownVariants.length > 1 && state.draftId ? (
                    <Button
                      variant={chosen === i ? "subtle" : "outline"}
                      size="sm"
                      className="self-start"
                      onClick={async () => {
                        setChosen(i);
                        await chooseVariant(props.slug, state.draftId!, i);
                      }}
                    >
                      {chosen === i ? <Check /> : null}{" "}
                      {chosen === i ? "Using this version" : "Use this version"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            {state.phase === "done" && state.draftId
              ? (props.onDone ?? (
                  <div className="flex flex-col gap-2 rounded-card border border-amber/40 bg-amber-tint p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm">
                      Waiting for you: review and approve it before it&apos;s used.
                    </p>
                    <Button asChild>
                      <Link href={`/${props.slug}/review?d=${state.draftId}`}>
                        Open in Review <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                ))
              : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
