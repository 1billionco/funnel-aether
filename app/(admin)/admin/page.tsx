import type { Metadata } from "next";

import { PageHeader } from "@/components/app/coming-soon";
import { Wordmark } from "@/components/app/wordmark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFounderAdmin } from "@/lib/auth/session";
import { aiStats } from "@/lib/admin/ai-stats";
import { createSupabaseServiceClient } from "@/lib/db/service";

import { AiControlsForm, CreateInviteForm, SignupSettingsForm } from "./forms";

export const metadata: Metadata = { title: "Founder admin", robots: { index: false } };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

export default async function AdminPage() {
  await requireFounderAdmin();
  const db = createSupabaseServiceClient();
  if (!db) return <p className="p-8">Set SUPABASE_SERVICE_ROLE_KEY to use the admin.</p>;

  const [{ data: settings }, { data: invites }, { data: orgs }, stats] = await Promise.all([
    db.from("app_settings").select("*").eq("id", true).single(),
    db.from("beta_invites").select("*").order("created_at", { ascending: false }).limit(50),
    db
      .from("organizations")
      .select(
        "id, name, slug, market, plan, status, created_at, last_active_at, onboarding_completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    aiStats(db),
  ]);
  const blend = stats.fastPct;
  const spent = stats.spentUsd;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <Wordmark href="/admin" />
      <PageHeader
        title="Founder admin"
        description="Beta controls. Guardrail tiles, funnel and cost telemetry arrive with analytics."
      />

      <Card>
        <CardHeader>
          <CardTitle>AI spend and kill switch</CardTitle>
          <CardDescription>
            Today: <span className="font-mono">${spent.toFixed(3)}</span> of{" "}
            <span className="font-mono">
              ${Number(settings?.ai_daily_budget_usd ?? 0).toFixed(2)}
            </span>
            {stats.breached ? " · Budget reached: generation paused until tomorrow (UTC)." : ""}
            {settings?.ai_kill_switch ? " · Kill switch is ON." : ""} · Router blend (7 days):{" "}
            {blend === null
              ? "no drafts yet"
              : `${blend}% fast / ${100 - blend}% smart (target ≈ 85/15)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiControlsForm
            killSwitch={!!settings?.ai_kill_switch}
            budget={Number(settings?.ai_daily_budget_usd ?? 5)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sign-ups</CardTitle>
            <CardDescription>
              {orgs?.length ?? 0} businesses of {settings?.max_orgs} allowed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupSettingsForm
              mode={settings?.signup_mode ?? "invite"}
              maxOrgs={settings?.max_orgs ?? 200}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New invite code</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateInviteForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite codes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 pr-4 font-normal">Code</th>
                <th className="py-2 pr-4 font-normal">Used</th>
                <th className="py-2 pr-4 font-normal">Country</th>
                <th className="py-2 pr-4 font-normal">Expires</th>
                <th className="py-2 font-normal">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(invites ?? []).map((i) => (
                <tr key={i.code}>
                  <td className="py-2 pr-4 font-mono">{i.code}</td>
                  <td className="py-2 pr-4 font-mono">
                    {i.used_count}/{i.max_uses}
                  </td>
                  <td className="py-2 pr-4">{i.market ?? "Any"}</td>
                  <td className="py-2 pr-4">{fmt(i.expires_at)}</td>
                  <td className="py-2 text-muted">{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Businesses</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 pr-4 font-normal">Name</th>
                <th className="py-2 pr-4 font-normal">Country</th>
                <th className="py-2 pr-4 font-normal">Plan</th>
                <th className="py-2 pr-4 font-normal">Onboarded</th>
                <th className="py-2 pr-4 font-normal">Joined</th>
                <th className="py-2 font-normal">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(orgs ?? []).map((o) => (
                <tr key={o.id}>
                  <td className="py-2 pr-4">{o.name}</td>
                  <td className="py-2 pr-4">{o.market}</td>
                  <td className="py-2 pr-4 capitalize">{o.plan}</td>
                  <td className="py-2 pr-4">
                    {o.onboarding_completed_at ? (
                      <Badge tone="approve">Yes</Badge>
                    ) : (
                      <Badge tone="outline">Not yet</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4">{fmt(o.created_at)}</td>
                  <td className="py-2">{fmt(o.last_active_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
