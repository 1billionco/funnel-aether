import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Inbox, Sparkles, Users } from "lucide-react";

import { CreditsRing } from "@/components/app/credits-meter";
import { CoreLoopChecklist } from "@/components/today/checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBlock } from "@/components/ui/misc";
import { requireOrg } from "@/lib/auth/session";
import { getPrimaryBrand } from "@/lib/brands";
import { coreLoop } from "@/lib/core-loop";
import { limit } from "@/lib/credits/plans";
import { greeting, longDate } from "@/lib/format";
import { getCoreLoopInput } from "@/lib/today-data";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ params }: PageProps<"/[org]/today">) {
  const { org: slug } = await params;
  const { org, db, user } = await requireOrg(slug);
  void db.rpc("touch_org_activity", { p_org: org.id });

  const brand = await getPrimaryBrand(db, org.id);
  const input = await getCoreLoopInput(db, org.id, brand);
  const loop = coreLoop(input, { lead: false, campaign: false });
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm text-muted">{longDate(org.timezone)}</p>
        <h1 className="mt-1 font-display text-2xl md:text-3xl">
          {greeting(org.timezone)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      {loop.next ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardDescription>Next best step</CardDescription>
            <CardTitle className="font-display text-xl font-normal">{loop.next.cta}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {loop.next.id === "approve"
                ? "Nothing goes out until you approve it."
                : loop.next.id === "brand" || loop.next.id === "train"
                  ? "The better we know your brand, the less you'll need to edit."
                  : "It takes about a minute. You'll review it before anything is used."}
            </p>
            <Button asChild>
              <Link href={`/${slug}/${loop.next.href}`}>
                {loop.next.cta} <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="waiting-title">
            <h2 id="waiting-title" className="mb-3 font-medium">
              Waiting for you
            </h2>
            {input.pendingDrafts > 0 ? (
              <Link
                href={`/${slug}/review`}
                className="flex items-center gap-4 rounded-card border border-amber/40 bg-amber-tint p-4"
              >
                <span className="font-display text-3xl">{input.pendingDrafts}</span>
                <span className="flex-1">
                  {input.pendingDrafts === 1 ? "draft needs" : "drafts need"} your decision
                </span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <StateBlock
                icon={<Inbox />}
                title="Nothing waiting for you"
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${slug}/create`}>
                      <Sparkles /> Create a draft
                    </Link>
                  </Button>
                }
              >
                New AI drafts land in Review for your approval.
              </StateBlock>
            )}
          </section>

          <section aria-labelledby="leads-title">
            <h2 id="leads-title" className="mb-3 font-medium">
              New hot leads
            </h2>
            <StateBlock icon={<Users />} title="No leads yet">
              Once your lead form is live, people who fill it in show up here with a score.
            </StateBlock>
          </section>

          <section
            aria-labelledby="week-title"
            className="rounded-card border border-line bg-surface p-5"
          >
            <h2 id="week-title" className="font-medium">
              This week
            </h2>
            <p className="mt-2 text-muted">
              {input.approvedThisWeek > 0
                ? `You approved ${input.approvedThisWeek} draft${input.approvedThisWeek === 1 ? "" : "s"}${input.postedThisWeek ? ` and posted ${input.postedThisWeek}` : ""}.`
                : "Nothing approved yet this week. Your first approved draft will show here."}
            </p>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-label="Credits" className="rounded-card border border-line bg-surface p-5">
            <CreditsRing
              balance={org.credit_balance_milli}
              allowance={limit(org, "monthly_credits_milli")}
            />
          </section>
          {!loop.complete ? (
            <CoreLoopChecklist slug={slug} steps={loop.steps} done={loop.done} total={loop.total} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
