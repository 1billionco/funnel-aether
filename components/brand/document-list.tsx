"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Globe, RotateCw, Trash2, Type } from "lucide-react";

import { deleteDocument, retryDocument } from "@/app/(app)/[org]/_actions/brand-docs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/brand-voice/quality";

export interface DocRow {
  id: string;
  title: string;
  doc_type: string;
  source: "upload" | "paste" | "url";
  status: "uploading" | "queued" | "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
  created_at: string;
}

const STATUS: Record<
  DocRow["status"],
  { label: string; tone: "neutral" | "info" | "approve" | "danger" }
> = {
  uploading: { label: "Uploading", tone: "neutral" },
  queued: { label: "Waiting", tone: "info" },
  processing: { label: "Reading…", tone: "info" },
  ready: { label: "Ready", tone: "approve" },
  failed: { label: "Couldn't read", tone: "danger" },
};

const ICON = { upload: FileText, paste: Type, url: Globe };

/** Lists samples and refreshes while any are still being read. */
export function DocumentList({
  slug,
  docs,
  canEdit,
}: {
  slug: string;
  docs: DocRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const active = docs.some((d) => d.status === "queued" || d.status === "processing");

  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [active, router]);

  if (!docs.length)
    return (
      <p className="text-sm text-muted">
        No samples yet. Your first one makes the biggest difference.
      </p>
    );

  return (
    <ul className="flex flex-col divide-y divide-line" aria-live="polite">
      {docs.map((d) => {
        const Icon = ICON[d.source];
        const s = STATUS[d.status];
        return (
          <li key={d.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Icon className="size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="text-xs text-muted">
                  {DOC_TYPE_LABELS[d.doc_type as DocType] ?? d.doc_type}
                  {d.status === "ready"
                    ? ` · ${d.chunk_count} section${d.chunk_count === 1 ? "" : "s"}`
                    : ""}
                </p>
                {d.status === "failed" && d.error ? (
                  <p className="text-xs text-danger-fg">{d.error}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1 pl-7 sm:pl-0">
              <Badge tone={s.tone}>{s.label}</Badge>
              {canEdit && d.status === "failed" ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Try reading ${d.title} again`}
                  disabled={busy === d.id}
                  onClick={async () => {
                    setBusy(d.id);
                    await retryDocument(slug, d.id);
                    setBusy(null);
                    router.refresh();
                  }}
                >
                  <RotateCw />
                </Button>
              ) : null}
              {canEdit && d.status !== "processing" ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${d.title}`}
                  disabled={busy === d.id}
                  onClick={async () => {
                    setBusy(d.id);
                    await deleteDocument(slug, d.id);
                    setBusy(null);
                    router.refresh();
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
