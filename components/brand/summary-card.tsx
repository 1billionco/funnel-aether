"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

import { approveBrandSummary, generateBrandSummary } from "@/app/(app)/[org]/_actions/brand-docs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";

/**
 * AI proposes the brand summary; the owner edits and approves it. Only an
 * approved summary is used in prompts.
 */
export function SummaryCard({
  slug,
  brandId,
  summary,
  status,
  canEdit,
  onApproved,
}: {
  slug: string;
  brandId: string;
  summary: string | null;
  status: string;
  canEdit: boolean;
  onApproved?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState(summary ?? "");
  const [editing, setEditing] = React.useState(status !== "approved");
  const [pending, setPending] = React.useState<"generate" | "approve" | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [isMock, setIsMock] = React.useState(false);

  async function generate() {
    setPending("generate");
    setMessage(null);
    const r = await generateBrandSummary(slug, brandId);
    setPending(null);
    if (r.ok && r.data) {
      setText(r.data.summary);
      setIsMock(r.data.isMock);
      setEditing(true);
    } else setMessage({ ok: false, text: r.message ?? "Something went wrong." });
  }

  async function approve() {
    setPending("approve");
    const r = await approveBrandSummary(slug, brandId, text);
    setPending(null);
    setMessage({ ok: r.ok, text: r.message ?? "" });
    if (r.ok) {
      setEditing(false);
      router.refresh();
      onApproved?.();
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="approve">
            <Check /> Approved by you
          </Badge>
        </div>
        <p className="leading-relaxed whitespace-pre-line">{text}</p>
        {canEdit ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setEditing(true)}
          >
            Edit summary
          </Button>
        ) : null}
        {message?.ok ? (
          <p role="status" className="text-sm text-approve-fg">
            {message.text}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!text ? (
        <p className="text-muted">
          We&apos;ll read your answers and samples and describe how you sound. You check it before
          we use it.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="pending">Needs your approval</Badge>
          <Badge tone="primary">
            <Sparkles /> Drafted by AI
          </Badge>
          {isMock ? <Badge tone="info">Mock output</Badge> : null}
        </div>
      )}
      {text ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-summary">Your brand summary</Label>
          <Textarea
            id="brand-summary"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-40"
            disabled={!canEdit}
          />
        </div>
      ) : null}
      {message && !message.ok ? (
        <p role="alert" className="text-sm text-danger-fg">
          {message.text}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant={text ? "outline" : "primary"} onClick={generate} disabled={!!pending}>
            <Sparkles />{" "}
            {pending === "generate"
              ? "Writing…"
              : text
                ? "Write it again"
                : "Write my brand summary"}
          </Button>
          {text ? (
            <Button variant="approve" onClick={approve} disabled={!!pending}>
              <Check /> {pending === "approve" ? "Saving…" : "Approve summary"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
