import type { Metadata } from "next";

import { PageHeader } from "@/components/app/coming-soon";
import { LiteModeToggle, OrganizationForm, ProfileForm } from "@/components/app/settings-forms";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";
import { limit } from "@/lib/credits/plans";
import { isLiteMode } from "@/lib/lite-mode.server";

export const metadata: Metadata = { title: "Settings" };

const COMMON_TIMEZONES = [
  "Europe/London",
  "Africa/Lagos",
  "Europe/Dublin",
  "Africa/Accra",
  "Europe/Paris",
  "America/New_York",
];

export default async function SettingsPage({ params }: PageProps<"/[org]/settings">) {
  const { org: slug } = await params;
  const { org, db, user, role } = await requireOrg(slug);
  const [lite, { data: profile }, { data: members }] = await Promise.all([
    isLiteMode(),
    db.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    db.from("memberships").select("user_id, role").eq("org_id", org.id).order("created_at"),
  ]);
  const { data: teammateProfiles } = await db
    .from("profiles")
    .select("user_id, full_name")
    .in(
      "user_id",
      (members ?? []).map((m) => m.user_id),
    );
  const nameOf = new Map((teammateProfiles ?? []).map((p) => [p.user_id, p.full_name]));
  const timezones = Array.from(new Set([org.timezone, ...COMMON_TIMEZONES]));
  const seats = limit(org, "seats");

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>You</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm slug={slug} fullName={profile?.full_name ?? ""} email={user.email ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your business</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganizationForm
              slug={slug}
              org={org}
              timezones={timezones}
              isOwner={role === "owner"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <LiteModeToggle on={lite} />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              {(members ?? []).length} of {seats} seat{seats === 1 ? "" : "s"} used. Inviting
              teammates comes with the Advanced plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-line">
              {(members ?? []).map((m) => (
                <li
                  key={m.user_id}
                  className="flex min-h-11 items-center justify-between gap-3 py-2"
                >
                  <span className="truncate">
                    {nameOf.get(m.user_id) ??
                      (m.user_id === user.id ? (user.email ?? "You") : "Teammate")}
                  </span>
                  <Badge tone="outline" className="capitalize">
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data &amp; privacy</CardTitle>
            <CardDescription>
              Exporting all your data and deleting your business are coming in a later update. Until
              then, email the founder and we&apos;ll do it within 30 days.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
