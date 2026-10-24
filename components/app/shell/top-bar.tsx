import Link from "next/link";
import { Check, ChevronsUpDown, LogOut, Plus, Settings } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/app/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/primitives";

import { FeedbackButton } from "./feedback-button";

export function TopBar({
  slug,
  orgName,
  orgs,
  userLabel,
}: {
  slug: string;
  orgName: string;
  orgs: { slug: string; name: string }[];
  userLabel: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-3 backdrop-blur md:px-6">
      <Wordmark
        href={`/${slug}/today`}
        className="lg:hidden [&>span:last-child]:hidden sm:[&>span:last-child]:inline"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="max-w-[55vw] min-w-0 gap-1.5 px-2 sm:max-w-xs"
            aria-label={`Business: ${orgName}. Switch business`}
          >
            <span className="truncate font-medium">{orgName}</span>
            <ChevronsUpDown className="text-muted" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {orgs.map((o) => (
            <DropdownMenuItem key={o.slug} asChild>
              <Link href={`/${o.slug}/today`}>
                <span className="flex-1 truncate">{o.name}</span>
                {o.slug === slug ? <Check className="size-4 text-primary-fg" /> : null}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href={`/${slug}/create`}>
            <Plus /> Create
          </Link>
        </Button>
        <FeedbackButton slug={slug} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <span className="grid size-8 place-items-center rounded-full bg-primary-tint text-sm font-medium text-primary-fg">
                {userLabel.slice(0, 1).toUpperCase()}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <p className="truncate px-2.5 py-2 text-xs text-muted">{userLabel}</p>
            <DropdownMenuItem asChild>
              <Link href={`/${slug}/settings`}>
                <Settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut className="size-4" /> Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
