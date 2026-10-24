"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, Inbox } from "lucide-react";

import {
  approveDraft,
  bulkApprove,
  rejectDraft,
  undoDecision,
} from "@/app/(app)/[org]/_actions/review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd, StateBlock } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { CHANNEL_LABELS, OUTPUT_TYPES, type Channel, type OutputType } from "@/lib/ai/output-types";
import { cn } from "@/lib/utils";

import { DraftDetail, type DraftDetailData } from "./draft-detail";

export interface DraftListItem {
  id: string;
  type: OutputType;
  channel: Channel;
  title: string | null;
  excerpt: string;
  status: string;
  brand_match_score: number | null;
  flagCount: number;
  created_at: string;
}

const SWIPE_THRESHOLD = 96;

/** Mobile card: swipe right to approve, left to reject, tap to open (spec §7.4 #2). */
function SwipeCard({
  item,
  href,
  onSwipe,
  selected,
}: {
  item: DraftListItem;
  href: string;
  onSwipe: (dir: "approve" | "reject") => void;
  selected: boolean;
}) {
  const [dx, setDxState] = React.useState(0);
  const dxRef = React.useRef(0);
  const setDx = (v: number) => {
    dxRef.current = v;
    setDxState(v);
  };
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const swiping = React.useRef(false);
  const swipeable = item.status === "pending" || item.status === "partial";

  return (
    <div
      className="relative overflow-hidden rounded-card"
      onPointerDown={(e) => {
        if (!swipeable || e.pointerType === "mouse") return;
        start.current = { x: e.clientX, y: e.clientY };
        swiping.current = false;
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const x = e.clientX - start.current.x;
        if (
          !swiping.current &&
          Math.abs(x) > 12 &&
          Math.abs(x) > Math.abs(e.clientY - start.current.y)
        )
          swiping.current = true;
        if (swiping.current) setDx(x);
      }}
      onPointerUp={() => {
        const moved = dxRef.current;
        if (swiping.current && Math.abs(moved) > SWIPE_THRESHOLD)
          onSwipe(moved > 0 ? "approve" : "reject");
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
      onClickCapture={(e) => {
        if (swiping.current) {
          e.preventDefault();
          e.stopPropagation();
          swiping.current = false;
        }
      }}
    >
      {swipeable && dx !== 0 ? (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center px-4 text-sm font-medium text-white",
            dx > 0 ? "justify-start bg-approve" : "justify-end bg-danger",
          )}
        >
          {dx > 0 ? "Approve" : dx < 0 ? "Reject" : ""}
        </div>
      ) : null}
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        draggable={false}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={cn(
          "relative flex min-h-11 flex-col gap-1 border border-line bg-surface p-3 transition-colors",
          dx === 0 && "transition-transform",
          selected ? "border-primary bg-primary-tint" : "hover:bg-paper",
        )}
      >
        <span className="flex items-center gap-2 text-xs text-muted">
          {OUTPUT_TYPES[item.type].label} · {CHANNEL_LABELS[item.channel]}
          {item.status === "pending" ? (
            <Badge tone="pending" className="ml-auto">
              Waiting
            </Badge>
          ) : item.status === "partial" ? (
            <Badge tone="pending" className="ml-auto">
              Stopped early
            </Badge>
          ) : (
            <Badge tone="outline" className="ml-auto capitalize">
              {item.status}
            </Badge>
          )}
        </span>
        <span className="line-clamp-1 font-medium">{item.title ?? "Untitled draft"}</span>
        <span className="line-clamp-2 text-sm text-muted">{item.excerpt}</span>
        <span className="flex items-center gap-2 text-xs">
          {item.brand_match_score !== null ? (
            <span className="text-muted">Match {item.brand_match_score}</span>
          ) : null}
          {item.flagCount ? (
            <span className="flex items-center gap-1 text-amber-ink">
              <AlertTriangle className="size-3" aria-hidden /> {item.flagCount} to check
            </span>
          ) : null}
        </span>
      </Link>
    </div>
  );
}

export function ReviewWorkspace({
  slug,
  items,
  selected,
  brandName,
  canEdit,
  canDecide,
  baseQuery,
  welcome,
}: {
  slug: string;
  items: DraftListItem[];
  selected: DraftDetailData | null;
  brandName: string;
  canEdit: boolean;
  canDecide: boolean;
  baseQuery: string;
  welcome: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const hrefFor = React.useCallback(
    (id: string) => `/${slug}/review?${baseQuery ? `${baseQuery}&` : ""}d=${id}`,
    [slug, baseQuery],
  );
  const index = selected ? items.findIndex((i) => i.id === selected.id) : -1;
  const lowRisk = items.filter(
    (i) => i.status === "pending" && i.flagCount === 0 && (i.brand_match_score ?? 0) >= 70,
  );

  const goNext = React.useCallback(() => {
    const next = items[index + 1] ?? items[index - 1];
    router.push(next ? hrefFor(next.id) : `/${slug}/review${baseQuery ? `?${baseQuery}` : ""}`);
  }, [items, index, router, hrefFor, slug, baseQuery]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        t.closest("input, textarea, select, [contenteditable], [role=dialog]")
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "j" && items.length) router.push(hrefFor((items[index + 1] ?? items[0])!.id));
      else if (k === "k" && items.length)
        router.push(hrefFor((items[index - 1] ?? items[items.length - 1])!.id));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, index, router, hrefFor]);

  async function swipe(item: DraftListItem, dir: "approve" | "reject") {
    const r =
      dir === "approve" ? await approveDraft(slug, item.id) : await rejectDraft(slug, item.id);
    if (!r.ok) return toast.show({ message: r.message ?? "Couldn't update.", tone: "danger" });
    toast.show({
      message: dir === "approve" ? "Approved." : "Rejected.",
      action: {
        label: "Undo",
        onClick: async () => {
          await undoDecision(slug, item.id);
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {welcome ? (
        <div role="status" className="rounded-card border border-primary/30 bg-primary-tint p-4">
          <p className="font-medium">Your first draft is ready.</p>
          <p className="text-sm text-muted">
            Read it, change anything you like, then approve it. Nothing goes out until you do.
          </p>
        </div>
      ) : null}

      {lowRisk.length > 1 && canDecide ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await bulkApprove(
                slug,
                lowRisk.map((i) => i.id),
              );
              toast.show({ message: r.message ?? "", tone: r.ok ? "neutral" : "danger" });
              router.refresh();
            }}
          >
            <CheckCheck /> Approve {lowRisk.length} low-risk drafts
          </Button>
          <span className="text-muted">No flags and a strong brand match.</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <nav
          aria-label="Drafts"
          className={cn("flex flex-col gap-2", selected && "hidden lg:flex")}
        >
          {items.length === 0 ? (
            <StateBlock
              icon={<Inbox />}
              title="Nothing here"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${slug}/create`}>Create a draft</Link>
                </Button>
              }
            >
              New AI drafts land here for your approval.
            </StateBlock>
          ) : (
            items.map((item) => (
              <SwipeCard
                key={item.id}
                item={item}
                href={hrefFor(item.id)}
                selected={selected?.id === item.id}
                onSwipe={(d) => swipe(item, d)}
              />
            ))
          )}
          {items.some((i) => i.status === "pending") ? (
            <p className="px-1 text-xs text-muted lg:hidden">
              Swipe right to approve, left to reject. Tap to read.
            </p>
          ) : null}
        </nav>

        <section aria-label="Selected draft" className={cn(!selected && "hidden lg:block")}>
          {selected ? (
            <DraftDetail
              key={`${selected.id}:${selected.updated_at}`}
              slug={slug}
              draft={selected}
              brandName={brandName}
              canEdit={canEdit}
              canDecide={canDecide}
              onDecided={goNext}
              backHref={`/${slug}/review${baseQuery ? `?${baseQuery}` : ""}`}
            />
          ) : items.length ? (
            <div className="rounded-card border border-dashed border-line p-8 text-center text-sm text-muted">
              Choose a draft to review. Shortcuts: <Kbd>J</Kbd>/<Kbd>K</Kbd> to move, <Kbd>A</Kbd>{" "}
              approve, <Kbd>E</Kbd> edit, <Kbd>R</Kbd> reject, <Kbd>G</Kbd> regenerate.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
