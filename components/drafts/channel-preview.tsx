import { CheckCheck, Globe2, Heart, MessageCircle, Repeat2, Send, ThumbsUp } from "lucide-react";

import type { Channel } from "@/lib/ai/output-types";
import { cn } from "@/lib/utils";

import { RichText } from "./rich-text";

export interface PreviewDraft {
  channel: Channel;
  body: string;
  metadata: { subject?: string; preheader?: string; hashtags?: string[] };
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-tint font-medium text-primary-fg"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Realistic previews so owners judge drafts as their customers will see them (spec §7.4 #2). */
export function ChannelPreview({
  draft,
  brandName,
  className,
}: {
  draft: PreviewDraft;
  brandName: string;
  className?: string;
}) {
  const hashtags = draft.metadata.hashtags?.filter((h) => !draft.body.includes(h)) ?? [];
  switch (draft.channel) {
    case "whatsapp":
      return (
        <div
          className={cn("rounded-card bg-[#efeae2] p-4 dark:bg-[#0b141a]", className)}
          data-testid="preview-whatsapp"
        >
          <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[15px] text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
            <RichText text={draft.body} />
            <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781] dark:text-[#8696a0]">
              09:41 <CheckCheck className="size-3.5 text-[#53bdeb]" aria-hidden />
            </p>
          </div>
        </div>
      );
    case "email":
      return (
        <div
          className={cn("overflow-hidden rounded-card border border-line bg-surface", className)}
          data-testid="preview-email"
        >
          <div className="border-b border-line px-4 py-3 text-sm">
            <p className="text-muted">
              From <span className="text-ink">{brandName}</span>
            </p>
            <p className="mt-1 font-semibold">{draft.metadata.subject || "(No subject yet)"}</p>
            {draft.metadata.preheader ? (
              <p className="text-muted">{draft.metadata.preheader}</p>
            ) : null}
          </div>
          <RichText text={draft.body} className="px-4 py-3" />
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            Footer with your business address and a one-click unsubscribe is added when it&apos;s
            sent.
          </p>
        </div>
      );
    case "x":
      return (
        <div
          className={cn("flex gap-3 rounded-card border border-line bg-surface p-4", className)}
          data-testid="preview-x"
        >
          <Avatar name={brandName} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{brandName}</span>{" "}
              <span className="text-muted">· 1m</span>
            </p>
            <RichText text={[draft.body, ...hashtags].join(" ")} className="mt-1" />
            <p
              className={cn(
                "mt-2 text-right font-mono text-xs",
                draft.body.length > 280 ? "text-danger-fg" : "text-muted",
              )}
            >
              {draft.body.length}/280
            </p>
          </div>
        </div>
      );
    case "web":
      return (
        <div
          className={cn("rounded-card border border-line bg-surface p-5", className)}
          data-testid="preview-web"
        >
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
            <Globe2 className="size-3.5" aria-hidden /> Web page preview
          </p>
          <RichText text={draft.body} />
        </div>
      );
    default: {
      const label =
        draft.channel === "linkedin"
          ? "LinkedIn"
          : draft.channel === "instagram"
            ? "Instagram"
            : "Facebook";
      return (
        <div
          className={cn("rounded-card border border-line bg-surface", className)}
          data-testid={`preview-${draft.channel}`}
        >
          <div className="flex items-center gap-3 px-4 pt-4">
            <Avatar name={brandName} />
            <div>
              <p className="text-sm font-semibold">{brandName}</p>
              <p className="text-xs text-muted">{label} · Just now</p>
            </div>
          </div>
          {draft.channel === "instagram" ? (
            <div aria-hidden className="mt-3 aspect-[4/3] bg-primary-tint" />
          ) : null}
          <div className="px-4 py-3">
            <RichText text={draft.body} />
            {hashtags.length ? (
              <p className="mt-2 text-sm text-info-fg">{hashtags.join(" ")}</p>
            ) : null}
          </div>
          <div
            className="flex justify-around border-t border-line py-2 text-xs text-muted"
            aria-hidden
          >
            {draft.channel === "instagram" ? (
              <>
                <Heart className="size-4" /> <MessageCircle className="size-4" />{" "}
                <Send className="size-4" />
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="size-4" /> Like
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-4" /> Comment
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 className="size-4" /> Share
                </span>
              </>
            )}
          </div>
        </div>
      );
    }
  }
}
