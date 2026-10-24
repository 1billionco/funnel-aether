import { redirect } from "next/navigation";

import { LiteHint } from "@/components/app/shell/lite-hint";
import { MobileNav } from "@/components/app/shell/mobile-nav";
import { Sidebar } from "@/components/app/shell/sidebar";
import { TopBar } from "@/components/app/shell/top-bar";
import { getMemberships, requireOrg } from "@/lib/auth/session";
import { isLiteMode } from "@/lib/lite-mode.server";
import { getShellCounts } from "@/lib/shell-data";

export default async function ShellLayout({ children, params }: LayoutProps<"/[org]">) {
  const { org: slug } = await params;
  const { org, db, user } = await requireOrg(slug);
  if (!org.onboarding_completed_at) redirect(`/${slug}/setup`);
  const [memberships, lite, counts] = await Promise.all([
    getMemberships(),
    isLiteMode(),
    getShellCounts(db, org.id),
  ]);
  const orgs = memberships.map((m) => ({ slug: m.organizations.slug, name: m.organizations.name }));
  const userLabel = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "You";

  return (
    <div className="flex min-h-dvh">
      <Sidebar slug={slug} pending={counts.pending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar slug={slug} orgName={org.name} orgs={orgs} userLabel={userLabel} />
        {lite ? null : <LiteHint />}
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <MobileNav slug={slug} pending={counts.pending} />
    </div>
  );
}
