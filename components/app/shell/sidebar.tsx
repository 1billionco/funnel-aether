"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/app/wordmark";
import { cn } from "@/lib/utils";

import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav";

function NavLink({ item, slug, badge }: { item: NavItem; slug: string; badge?: number }) {
  const pathname = usePathname();
  const href = item.href(slug);
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-input px-3 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink",
        active &&
          "bg-primary-tint font-medium text-primary-fg hover:bg-primary-tint hover:text-primary-fg",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span
          className="rounded-full bg-amber px-2 py-0.5 font-mono text-xs text-on-amber"
          aria-label={`${badge} waiting for you`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  slug,
  pending,
  footer,
}: {
  slug: string;
  pending: number;
  footer?: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
      <Wordmark href={`/${slug}/today`} className="px-2" />
      <nav aria-label="Main" className="mt-6 flex flex-col gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            slug={slug}
            badge={item.id === "review" ? pending : undefined}
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        {footer}
        <nav aria-label="Account" className="flex flex-col gap-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.id} item={item} slug={slug} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
