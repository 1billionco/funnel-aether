"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

import { MOBILE_TABS, PRIMARY_NAV, SECONDARY_NAV } from "./nav";

export function MobileNav({ slug, pending }: { slug: string; pending: number }) {
  const pathname = usePathname();
  const tabs = PRIMARY_NAV.filter((i) => MOBILE_TABS.includes(i.id));
  const more = [...PRIMARY_NAV.filter((i) => !MOBILE_TABS.includes(i.id)), ...SECONDARY_NAV];
  const moreActive = more.some((i) => pathname.startsWith(i.href(slug)));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {tabs.map((item) => {
        const href = item.href(slug);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted",
              active && "text-primary-fg",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
            {item.id === "review" && pending > 0 ? (
              <span
                className="absolute top-2 left-1/2 ml-2 rounded-full bg-amber px-1.5 font-mono text-[11px] leading-4 text-on-amber"
                aria-label={`${pending} waiting for you`}
              >
                {pending}
              </span>
            ) : null}
          </Link>
        );
      })}
      <Dialog>
        <DialogTrigger
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted",
            moreActive && "text-primary-fg",
          )}
        >
          <Menu className="size-5" aria-hidden />
          More
        </DialogTrigger>
        <DialogContent title="More" className="top-auto bottom-0 translate-y-0 rounded-b-none">
          <ul className="flex flex-col">
            {more.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href(slug)}
                    className="flex h-12 items-center gap-3 rounded-input px-2 hover:bg-ink/5"
                  >
                    <Icon className="size-5 text-muted" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
