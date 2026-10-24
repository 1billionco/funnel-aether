"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  Copy,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  PlayCircle,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

import {
  approveDraft,
  chooseVariant,
  markPosted,
  rateDraft,
  rejectDraft,
  saveDraftEdit,
  scheduleDraft,
  undoDecision,
} from "@/app/(app)/[org]/_actions/review";
import { ChannelPreview } from "@/components/drafts/channel-preview";
import {
  AiLabel,
  BrandMatchChip,
  FlagsList,
  MatchReasons,
  type MatchReason,
} from "@/components/drafts/quality";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd, Metric } from "@/components/ui/misc";
import { Dialog, DialogContent, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { CHANNEL_LABELS, OUTPUT_TYPES, type Channel, type OutputType } from "@/lib/ai/output-types";
import { wordDiff } from "@/lib/diff";
import { formatCredits } from "@/lib/format";
import { useGeneration } from "@/lib/hooks/use-generation";
import { cn } from "@/lib/utils";

export interface DraftDetailData {
  id: string;
  type: OutputType;
  channel: Channel;
  title: string | null;
  body: string;
  status: string;
  metadata: {
    subject?: string;
    preheader?: string;
    hashtags?: string[];
    variants?: string[];
    selected_variant?: number;
    brief?: { goal: string; offer?: string; audience?: string; details?: string };
  };
  brand_match_score: number | null;
  brand_match_reasons: MatchReason[];
  flags: { type: string; message: string }[];
  model_used: string | null;
  tier: string | null;
  credits_used: number;
  is_mock: boolean;
  error: string | null;
  rejected_reason: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  versions: {
    version: number;
    source: string;
    body: string;
    created_at: string;
    feedback_text: string | null;
  }[];
}

const STATUS_CHIP: Record<
  string,
  { label: string; tone: "pending" | "approve" | "danger" | "neutral" | "info" | "outline" }
> = {
  pending: { label: "Waiting for you", tone: "pending" },
  partial: { label: "Stopped early", tone: "pending" },
  approved: { label: "Approved", tone: "approve" },
  rejected: { label: "Rejected", tone: "danger" },
  scheduled: { label: "Reminder set", tone: "info" },
  posted: { label: "Posted", tone: "approve" },
  sent: { label: "Sent", tone: "approve" },
  generating: { label: "Writing…", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  archived: { label: "Archived", tone: "outline" },
};

export function DraftDetail({
  slug,
  draft,
  brandName,
  canEdit,
  canDecide,
  onDecided,
  backHref,
}: {
  slug: string;
  draft: DraftDetailData;
  brandName: string;
  canEdit: boolean;
  canDecide: boolean;
  onDecided?: () => void;
  backHref?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(draft.body);
  const [subject, setSubject] = React.useState(draft.metadata.subject ?? "");
  const [preheader, setPreheader] = React.useState(draft.metadata.preheader ?? "");
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [remindAt, setRemindAt] = React.useState("");
  const editorRef = React.useRef<HTMLTextAreaElement>(null);
  const regen = useGeneration(slug);

  const decidable = canDecide && (draft.status === "pending" || draft.status === "partial");
  const editable =
    canEdit &&
    (draft.status === "pending" || draft.status === "partial" || draft.status === "rejected");
  const isAsset = draft.type !== "email";
  const variants = draft.metadata.variants ?? [];

  const dirty =
    body !== draft.body ||
    subject !== (draft.metadata.subject ?? "") ||
    preheader !== (draft.metadata.preheader ?? "");
  const editPayload = () => ({ body, ...(draft.type === "email" ? { subject, preheader } : {}) });

  const approve = React.useCallback(async () => {
    if (!decidable) return;
    setPending("approve");
    const r = await approveDraft(slug, draft.id, editing && dirty ? editPayload() : undefined);
    setPending(null);
    if (!r.ok) return toast.show({ message: r.message ?? "Couldn't approve.", tone: "danger" });
    setEditing(false);
    toast.show({
      message: "Approved. Nothing has been sent or posted.",
      action: {
        label: "Undo",
        onClick: async () => {
          await undoDecision(slug, draft.id);
          router.refresh();
        },
      },
    });
    onDecided?.();
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decidable, slug, draft.id, editing, dirty, body, subject, preheader]);

  const reject = async (reason: string) => {
    setPending("reject");
    const r = await rejectDraft(slug, draft.id, reason);
    setPending(null);
    setRejectOpen(false);
    if (!r.ok) return toast.show({ message: r.message ?? "Couldn't reject.", tone: "danger" });
    toast.show({
      message: "Rejected.",
      action: {
        label: "Undo",
        onClick: async () => {
          await undoDecision(slug, draft.id);
          router.refresh();
        },
      },
    });
    onDecided?.();
    router.refresh();
  };

  // Keyboard shortcuts for the open draft (spec §7.4 #2): A approve, E edit, R reject, G regenerate.
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
      if (k === "a" && decidable) {
        e.preventDefault();
        void approve();
      } else if (k === "e" && editable) {
        e.preventDefault();
        setEditing(true);
        setTimeout(() => editorRef.current?.focus(), 0);
      } else if (k === "r" && decidable) {
        e.preventDefault();
        setRejectOpen(true);
      } else if (k === "g" && canEdit) {
        e.preventDefault();
        setRegenOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, decidable, editable, canEdit]);

  const brief = draft.metadata.brief ?? { goal: draft.title ?? "Draft" };
  const afterRegen = (r: { phase: string; message?: string }) => {
    setRegenOpen(false);
    if (r.phase === "error")
      toast.show({ message: r.message ?? "Couldn't regenerate.", tone: "danger" });
    else
      toast.show({
        message:
          r.phase === "background"
            ? "Writing a new version in the background…"
            : "New version ready for review.",
      });
    regen.reset();
    router.refresh();
  };
  const regenerate = async (feedback: string) =>
    afterRegen(
      await regen.generate({
        type: draft.type,
        channel: draft.channel,
        variants: 1,
        brief,
        regenerate: { draftId: draft.id, feedback },
      }),
    );
  const continueDraft = async () =>
    afterRegen(
      await regen.generate({
        type: draft.type,
        channel: draft.channel,
        variants: 1,
        brief,
        continueDraftId: draft.id,
      }),
    );

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(
        draft.type === "email" ? `${draft.metadata.subject ?? ""}\n\n${draft.body}` : draft.body,
      );
      toast.show({ message: "Copied. Paste it wherever you post." });
    } catch {
      toast.show({
        message: "Couldn't copy. Select the text and copy it manually.",
        tone: "danger",
      });
    }
  };

  const status = STATUS_CHIP[draft.status] ?? { label: draft.status, tone: "neutral" as const };
  const regenerating =
    regen.state.phase === "starting" ||
    regen.state.phase === "streaming" ||
    regen.state.phase === "background";

  return (
    <article aria-labelledby="draft-title" className="flex flex-col gap-4">
      {backHref ? (
        <a
          href={backHref}
          className="flex min-h-11 items-center gap-1 text-sm text-muted lg:hidden"
        >
          <ArrowLeft className="size-4" /> All drafts
        </a>
      ) : null}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <AiLabel isMock={draft.is_mock} />
          <BrandMatchChip score={draft.brand_match_score} reasons={draft.brand_match_reasons} />
        </div>
        <h2 id="draft-title" className="font-display text-xl">
          {draft.title ?? OUTPUT_TYPES[draft.type].label}
        </h2>
        <p className="text-sm text-muted">
          {OUTPUT_TYPES[draft.type].label} · {CHANNEL_LABELS[draft.channel]} ·{" "}
          {draft.model_used === "mock"
            ? "Mock generator"
            : draft.tier === "smart"
              ? "Smart model"
              : "Fast model"}{" "}
          · <Metric>{formatCredits(draft.credits_used)}</Metric> credits
        </p>
      </header>

      {draft.error && (draft.status === "partial" || draft.status === "failed") ? (
        <p className="rounded-input bg-amber-tint px-3 py-2 text-sm text-amber-ink">
          {draft.error}
        </p>
      ) : null}
      {draft.status === "rejected" && draft.rejected_reason ? (
        <p className="text-sm text-muted">Rejected because: {draft.rejected_reason}</p>
      ) : null}
      <FlagsList flags={draft.flags} />
      <MatchReasons reasons={draft.brand_match_reasons} />

      {variants.length > 1 && decidable && canEdit && !editing ? (
        <div role="radiogroup" aria-label="Choose a version" className="flex flex-wrap gap-2">
          {variants.map((_, i) => (
            <Button
              key={i}
              role="radio"
              aria-checked={(draft.metadata.selected_variant ?? 0) === i}
              size="sm"
              variant={(draft.metadata.selected_variant ?? 0) === i ? "subtle" : "outline"}
              onClick={async () => {
                await chooseVariant(slug, draft.id, i);
                router.refresh();
              }}
            >
              Version {i + 1}
            </Button>
          ))}
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-3">
          {draft.type === "email" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-subject">Subject line</Label>
                <Input
                  id="edit-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-preheader">Preview text</Label>
                <Input
                  id="edit-preheader"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-body">Draft</Label>
            <Textarea
              id="edit-body"
              ref={editorRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-64 font-[inherit]"
            />
            <p className="text-right font-mono text-xs text-muted">{body.length} characters</p>
          </div>
        </div>
      ) : regenerating ? (
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="mb-2 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Writing a new version…
          </p>
          <p className="whitespace-pre-line">{regen.state.text}</p>
        </div>
      ) : (
        <ChannelPreview
          draft={{ channel: draft.channel, body: draft.body, metadata: draft.metadata }}
          brandName={brandName}
        />
      )}

      {/* Decision bar */}
      <div className="sticky bottom-16 z-10 -mx-1 flex flex-wrap gap-2 rounded-card border border-line bg-surface/95 p-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        {decidable ? (
          <Button
            variant="approve"
            onClick={approve}
            disabled={!!pending || regenerating}
            aria-keyshortcuts="a"
          >
            <Check /> {editing && dirty ? "Save and approve" : "Approve"}{" "}
            <Kbd className="hidden border-white/30 bg-white/10 text-white lg:inline-flex">A</Kbd>
          </Button>
        ) : null}
        {editable && !editing ? (
          <Button variant="outline" onClick={() => setEditing(true)} aria-keyshortcuts="e">
            <Pencil /> Edit <Kbd className="hidden lg:inline-flex">E</Kbd>
          </Button>
        ) : null}
        {editing ? (
          <>
            <Button
              variant="outline"
              disabled={!dirty || !!pending}
              onClick={async () => {
                setPending("save");
                const r = await saveDraftEdit(slug, draft.id, editPayload());
                setPending(null);
                if (r.ok) {
                  setEditing(false);
                  router.refresh();
                } else toast.show({ message: r.message ?? "Couldn't save.", tone: "danger" });
              }}
            >
              Save edit
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBody(draft.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : null}
        {decidable && !editing ? (
          <Button
            variant="outline"
            className="text-danger-fg"
            onClick={() => setRejectOpen(true)}
            aria-keyshortcuts="r"
          >
            <X /> Reject <Kbd className="hidden lg:inline-flex">R</Kbd>
          </Button>
        ) : null}
        {canEdit && !editing && ["pending", "partial", "rejected"].includes(draft.status) ? (
          <Button
            variant="subtle"
            onClick={() => setRegenOpen(true)}
            disabled={regenerating}
            aria-keyshortcuts="g"
          >
            <RefreshCw /> Regenerate <Kbd className="hidden lg:inline-flex">G</Kbd>
          </Button>
        ) : null}
        {canEdit && draft.status === "partial" && !editing ? (
          <Button variant="outline" onClick={continueDraft} disabled={regenerating}>
            <PlayCircle /> Continue
          </Button>
        ) : null}

        {["approved", "scheduled"].includes(draft.status) ? (
          <>
            <Button variant="outline" onClick={copyText}>
              <Copy /> Copy text
            </Button>
            {draft.channel === "whatsapp" ? (
              <Button asChild variant="outline">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(draft.body)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle /> Open in WhatsApp
                </a>
              </Button>
            ) : null}
            {isAsset && canDecide ? (
              <Button
                variant="approve"
                onClick={async () => {
                  const r = await markPosted(slug, draft.id);
                  toast.show({ message: r.message ?? "", tone: r.ok ? "neutral" : "danger" });
                  router.refresh();
                }}
              >
                <Send /> Mark as posted
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {["approved", "scheduled"].includes(draft.status) && isAsset && canDecide ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await scheduleDraft(slug, draft.id, remindAt);
            toast.show({ message: r.message ?? "", tone: r.ok ? "neutral" : "danger" });
            if (r.ok) router.refresh();
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="remind-at">Remind me to post it</Label>
            <Input
              id="remind-at"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="outline">
            <Bell /> Set reminder
          </Button>
        </form>
      ) : null}
      {draft.scheduled_for ? (
        <p className="text-sm text-muted">
          Reminder set for{" "}
          {new Date(draft.scheduled_for).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          .
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
        <span>Was this draft useful?</span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Useful"
          onClick={async () =>
            toast.show({ message: (await rateDraft(slug, draft.id, 1)).message ?? "" })
          }
        >
          <ThumbsUp />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Not useful"
          onClick={async () =>
            toast.show({ message: (await rateDraft(slug, draft.id, -1)).message ?? "" })
          }
        >
          <ThumbsDown />
        </Button>
        {draft.versions.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
          >
            <History /> {draft.versions.length} versions
          </Button>
        ) : null}
      </div>

      {showHistory ? (
        <ol className="flex flex-col gap-3" aria-label="Version history">
          {draft.versions
            .slice()
            .reverse()
            .map((v, i, arr) => {
              const prev = arr[i + 1];
              return (
                <li key={v.version} className="rounded-card border border-line p-3 text-sm">
                  <p className="mb-1 text-xs text-muted">
                    Version {v.version} ·{" "}
                    {v.source === "human_edit"
                      ? "Your edit"
                      : v.source === "ai_regen"
                        ? "AI rewrite"
                        : "AI draft"}{" "}
                    ·{" "}
                    {new Date(v.created_at).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {v.feedback_text ? ` · “${v.feedback_text}”` : ""}
                  </p>
                  <p className="whitespace-pre-line">
                    {prev
                      ? wordDiff(prev.body, v.body).map((p, k) => (
                          <span
                            key={k}
                            className={cn(
                              p.type === "add" && "bg-approve/15 text-approve-fg",
                              p.type === "del" && "bg-danger/10 text-danger-fg line-through",
                            )}
                          >
                            {p.text}
                          </span>
                        ))
                      : v.body}
                  </p>
                </li>
              );
            })}
        </ol>
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          title="Reject this draft?"
          description="Optional: say why, so the next draft is better."
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void reject(String(new FormData(e.currentTarget).get("reason") ?? ""));
            }}
          >
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea id="reject-reason" name="reason" className="min-h-20" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={pending === "reject"}>
                Reject
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent
          title="Regenerate with feedback"
          description="Tell the AI what to change. You'll review the new version before anything is used."
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const feedback = String(new FormData(e.currentTarget).get("feedback") ?? "").trim();
              if (feedback.length >= 3) void regenerate(feedback);
            }}
          >
            <Label htmlFor="regen-feedback">What should change?</Label>
            <Textarea
              id="regen-feedback"
              name="feedback"
              className="min-h-20"
              placeholder="e.g. Shorter, warmer, mention free delivery"
              required
              minLength={3}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRegenOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={regenerating}>
                {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />} Regenerate
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </article>
  );
}
