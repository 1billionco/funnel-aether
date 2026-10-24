import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/coming-soon";
import { ReviewWorkspace, type DraftListItem } from "@/components/review/review-workspace";
import type { DraftDetailData } from "@/components/review/draft-detail";
import { requireOrg } from "@/lib/auth/session";
import { getPrimaryBrand } from "@/lib/brands";
import { FULL_PAGE_SIZE, LITE_PAGE_SIZE } from "@/lib/lite-mode";
import { isLiteMode } from "@/lib/lite-mode.server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review" };

const FILTERS = [
  { id: "waiting", label: "Waiting for you", statuses: ["pending", "partial"] },
  { id: "approved", label: "Approved", statuses: ["approved", "scheduled", "posted", "sent"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected", "failed"] },
  {
    id: "all",
    label: "All",
    statuses: [
      "pending",
      "partial",
      "approved",
      "scheduled",
      "posted",
      "sent",
      "rejected",
      "failed",
      "generating",
    ],
  },
] as const;

export default async function ReviewPage({ params, searchParams }: PageProps<"/[org]/review">) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, db, role } = await requireOrg(slug);
  const filter = FILTERS.find((f) => f.id === sp.status) ?? FILTERS[0];
  const lite = await isLiteMode();
  const pageSize = lite ? LITE_PAGE_SIZE : FULL_PAGE_SIZE;
  const selectedId = typeof sp.d === "string" ? sp.d : null;

  const [brand, { data: rows }] = await Promise.all([
    getPrimaryBrand(db, org.id),
    db
      .from("drafts")
      .select("id, type, channel, title, body, status, brand_match_score, flags, created_at")
      .eq("org_id", org.id)
      .in("status", [...filter.statuses])
      .order("created_at", { ascending: false })
      .limit(pageSize),
  ]);
  const items: DraftListItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    type: r.type as DraftListItem["type"],
    channel: r.channel as DraftListItem["channel"],
    title: r.title,
    excerpt: r.body.replace(/\s+/g, " ").slice(0, 140),
    status: r.status,
    brand_match_score: r.brand_match_score,
    flagCount: Array.isArray(r.flags) ? r.flags.length : 0,
    created_at: r.created_at,
  }));

  let selected: DraftDetailData | null = null;
  if (selectedId && /^[0-9a-f-]{36}$/.test(selectedId)) {
    const [{ data: d }, { data: versions }] = await Promise.all([
      db.from("drafts").select("*").eq("org_id", org.id).eq("id", selectedId).maybeSingle(),
      db
        .from("draft_versions")
        .select("version, source, body, created_at, feedback_text")
        .eq("org_id", org.id)
        .eq("draft_id", selectedId)
        .order("version"),
    ]);
    if (d) selected = { ...(d as unknown as DraftDetailData), versions: versions ?? [] };
  }

  const baseQuery = filter.id === "waiting" ? "" : `status=${filter.id}`;
  return (
    <>
      <PageHeader
        title="Review"
        description="Every AI draft waits here for your decision. Nothing is published or sent until you approve it."
      />
      <nav
        aria-label="Filter drafts"
        className="mb-4 flex gap-1 overflow-x-auto border-b border-line"
      >
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/${slug}/review${f.id === "waiting" ? "" : `?status=${f.id}`}`}
            aria-current={f.id === filter.id ? "page" : undefined}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-muted hover:text-ink",
              f.id === filter.id && "border-primary text-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <ReviewWorkspace
        slug={slug}
        items={items}
        selected={selected}
        brandName={brand?.name ?? org.name}
        canEdit={role === "owner" || role === "editor"}
        canDecide
        baseQuery={baseQuery}
        welcome={sp.welcome === "1"}
      />
    </>
  );
}
