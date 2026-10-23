import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Inbox, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd, Metric, Skeleton, StateBlock } from "@/components/ui/misc";
import { Label } from "@/components/ui/primitives";
import { services } from "@/lib/env";

import { InteractiveShowcase } from "./interactive";

// Rendered per request so the service-mode chips reflect runtime env vars.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const colours: { name: string; token: string; note?: string }[] = [
  { name: "Paper", token: "--paper" },
  { name: "Surface", token: "--surface" },
  { name: "Ink", token: "--ink" },
  { name: "Muted", token: "--muted" },
  { name: "Line", token: "--line" },
  { name: "Aether teal", token: "--primary", note: "Actions, AI" },
  { name: "Teal hover", token: "--primary-hover" },
  { name: "Teal tint", token: "--primary-tint" },
  { name: "Signal amber", token: "--amber", note: "A human needs to act" },
  { name: "Amber tint", token: "--amber-tint" },
  { name: "Amber ink", token: "--amber-ink", note: "Amber as text" },
  { name: "Approve", token: "--approve" },
  { name: "Danger", token: "--danger" },
  { name: "Info", token: "--info" },
];

const typeScale = [
  { px: 44, cls: "text-3xl font-display" },
  { px: 32, cls: "text-2xl font-display" },
  { px: 24, cls: "text-xl font-display" },
  { px: 20, cls: "text-lg font-semibold" },
  { px: 16, cls: "text-base" },
  { px: 14, cls: "text-sm" },
  { px: 12, cls: "text-xs" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-display text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  const svc = services();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-muted uppercase">
            Funnel Aether · /dev/ui
          </p>
          <h1 className="mt-1 font-display text-2xl md:text-3xl">Calm control</h1>
          <p className="mt-2 max-w-xl text-muted">
            Human decisions are visually central; AI is the quiet assistant around them. Amber
            appears only when you need to act.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section id="services" title="Service modes">
        <p className="text-sm text-muted">
          Integrations without keys run as clearly labelled mocks so the app works end-to-end
          locally.
        </p>
        <ul className="flex flex-wrap gap-2" data-testid="service-modes">
          {Object.entries(svc).map(([name, mode]) => (
            <li key={name}>
              <Badge tone={mode === "live" ? "approve" : mode === "mock" ? "info" : "outline"}>
                {name}: {mode}
              </Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="colour" title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {colours.map((c) => (
            <li
              key={c.token}
              className="overflow-hidden rounded-card border border-line bg-surface"
            >
              <div
                className="h-16 border-b border-line"
                style={{ background: `var(${c.token})` }}
              />
              <div className="p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="font-mono text-xs text-muted">{c.token}</p>
                {c.note ? <p className="mt-1 text-xs text-muted">{c.note}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Type">
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          {typeScale.map((t) => (
            <div key={t.px} className="flex items-baseline gap-4">
              <Metric className="w-10 shrink-0 text-xs text-muted">{t.px}</Metric>
              <p className={`${t.cls} truncate`}>Your whole funnel, overseen</p>
            </div>
          ))}
          <p className="mt-2 text-sm text-muted">
            Fraunces for display and hero numbers · Geist Sans for UI ·{" "}
            <Metric className="text-ink">Geist Mono 12.5 credits</Metric> for metrics
          </p>
        </div>
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Sparkles /> Generate draft
          </Button>
          <Button variant="approve">Approve</Button>
          <Button variant="outline">Edit</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="subtle">Regenerate with feedback</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="link">Learn more</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="outline">
            Small
          </Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section id="chips" title="Chips">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="pending">3 waiting for you</Badge>
          <Badge tone="pendingSolid">Needs approval</Badge>
          <Badge tone="approve">
            <CheckCircle2 /> Approved
          </Badge>
          <Badge tone="danger">Rejected</Badge>
          <Badge tone="primary">Brand match 82</Badge>
          <Badge tone="info">Mock output</Badge>
          <Badge tone="neutral">Draft</Badge>
          <Badge tone="outline">Cold</Badge>
        </div>
      </Section>

      <Section id="forms" title="Form fields">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev-name">Business name</Label>
            <Input id="dev-name" placeholder="Hartley & Co. Advisory" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev-email">Email (invalid)</Label>
            <Input
              id="dev-email"
              aria-invalid
              defaultValue="sarah@"
              aria-describedby="dev-email-err"
            />
            <p id="dev-email-err" className="text-sm text-danger-fg">
              Enter a full email address.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="dev-brief">Brief</Label>
            <Textarea id="dev-brief" placeholder="What should this post achieve?" />
          </div>
        </div>
      </Section>

      <Section id="interactive" title="Controls">
        <InteractiveShowcase />
      </Section>

      <Section id="cards" title="Cards">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Next best step</CardDescription>
              <CardTitle className="font-display text-xl font-normal">
                Approve your first draft
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              Nothing goes out until you approve it.
            </CardContent>
            <CardFooter>
              <Button size="sm">Open Review</Button>
            </CardFooter>
          </Card>
          <Card className="border-amber/40 bg-amber-tint">
            <CardHeader>
              <CardDescription className="text-amber-ink">Waiting for you</CardDescription>
              <CardTitle className="font-display text-3xl font-normal">3</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">drafts need your decision</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Credits remaining</CardDescription>
              <CardTitle>
                <Metric className="text-2xl">212.5</Metric>
                <span className="text-sm text-muted"> / 250</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="states" title="States">
        <div className="grid gap-4 md:grid-cols-3">
          <StateBlock
            icon={<Inbox />}
            title="Nothing waiting for you"
            action={
              <Button size="sm" variant="outline">
                Create a draft
              </Button>
            }
          >
            New AI drafts land here for your approval.
          </StateBlock>
          <StateBlock
            tone="danger"
            icon={<AlertTriangle />}
            title="Couldn't load your drafts"
            action={
              <Button size="sm" variant="outline">
                Try again
              </Button>
            }
          >
            Check your connection. Nothing was lost.
          </StateBlock>
          <StateBlock tone="approve" icon={<CheckCircle2 />} title="All caught up">
            You approved 4 drafts today.
          </StateBlock>
        </div>
        <div
          className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5"
          role="status"
          aria-busy="true"
          aria-label="Loading example"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Section>

      <Section id="keys" title="Keyboard">
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            <Kbd>A</Kbd> Approve
          </span>
          <span>
            <Kbd>E</Kbd> Edit
          </span>
          <span>
            <Kbd>R</Kbd> Reject
          </span>
          <span>
            <Kbd>G</Kbd> Regenerate
          </span>
          <span>
            <Kbd>⌘</Kbd> <Kbd>K</Kbd> Command palette
          </span>
        </p>
      </Section>
    </main>
  );
}
