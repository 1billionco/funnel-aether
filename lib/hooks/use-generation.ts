"use client";

import * as React from "react";

import { getDraftStatus } from "@/app/(app)/[org]/_actions/review";
import { splitVariants } from "@/lib/ai/output-parser";
import type { GenerateBody } from "@/lib/validation/generate";

export interface GenerationState {
  phase: "idle" | "starting" | "streaming" | "background" | "done" | "error";
  text: string;
  draftId?: string;
  status?: "pending" | "partial";
  variants: string[];
  brandMatch?: { score: number; reasons: { positive: boolean; text: string }[] };
  flags: { type: string; message: string }[];
  millicredits?: number;
  estimateMillicredits?: number;
  tier?: "fast" | "smart";
  isMock?: boolean;
  escalating?: boolean;
  message?: string;
  errorCode?: string;
}

const INITIAL: GenerationState = { phase: "idle", text: "", variants: [], flags: [] };

/** Streams NDJSON from /api/generate; polls the draft for background (long-form) jobs. */
export function useGeneration(slug: string) {
  const [state, setState] = React.useState<GenerationState>(INITIAL);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  const poll = React.useCallback(
    (draftId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const d = await getDraftStatus(slug, draftId).catch(() => null);
        if (!d) return;
        if (d.status === "generating") {
          setState((s) => ({ ...s, text: d.body, variants: splitVariants(d.body) }));
          return;
        }
        if (pollRef.current) clearInterval(pollRef.current);
        const meta = (d.metadata ?? {}) as { variants?: string[] };
        if (d.status === "failed")
          setState((s) => ({ ...s, phase: "error", message: d.error ?? "Generation failed." }));
        else
          setState((s) => ({
            ...s,
            phase: "done",
            status: d.status === "partial" ? "partial" : "pending",
            text: d.body,
            variants: meta.variants ?? [d.body],
            brandMatch:
              d.brand_match_score !== null
                ? { score: d.brand_match_score, reasons: [] }
                : undefined,
          }));
      }, 1500);
    },
    [slug],
  );

  const generate = React.useCallback(
    async (body: Omit<GenerateBody, "org">): Promise<GenerationState> => {
      let final: GenerationState = { ...INITIAL, phase: "starting" };
      const update = (fn: (s: GenerationState) => GenerationState) => {
        final = fn(final);
        setState(final);
      };
      setState(final);
      let res: Response;
      try {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, org: slug }),
        });
      } catch {
        update(() => ({
          ...INITIAL,
          phase: "error",
          message: "We couldn't reach the server. Check your connection and try again.",
        }));
        return final;
      }
      if (res.status === 202) {
        const j = (await res.json()) as {
          draftId: string;
          estimateMillicredits: number;
          tier: "fast" | "smart";
          isMock: boolean;
        };
        update(() => ({
          ...INITIAL,
          phase: "background",
          draftId: j.draftId,
          estimateMillicredits: j.estimateMillicredits,
          tier: j.tier,
          isMock: j.isMock,
        }));
        poll(j.draftId);
        return final;
      }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        update(() => ({
          ...INITIAL,
          phase: "error",
          message: j.message ?? "Something went wrong. Please try again.",
          errorCode: j.error,
        }));
        return final;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Record<string, unknown>;
          switch (ev.type) {
            case "start":
              update((s) => ({
                ...s,
                phase: "streaming",
                draftId: ev.draftId as string,
                estimateMillicredits: ev.estimateMillicredits as number,
                tier: ev.tier as "fast" | "smart",
                isMock: ev.isMock as boolean,
              }));
              break;
            case "delta":
              text += ev.text as string;
              update((s) => ({ ...s, text, variants: splitVariants(text) }));
              break;
            case "escalating":
              update((s) => ({ ...s, escalating: true }));
              break;
            case "done":
              update((s) => ({
                ...s,
                phase: "done",
                escalating: false,
                draftId: ev.draftId as string,
                status: ev.status as "pending" | "partial",
                variants: ev.variants as string[],
                text: (ev.variants as string[]).join("\n\n"),
                brandMatch: ev.brandMatch as GenerationState["brandMatch"],
                flags: ev.flags as GenerationState["flags"],
                millicredits: ev.millicredits as number,
              }));
              break;
            case "error":
              update((s) => ({ ...s, phase: "error", message: ev.message as string }));
              break;
          }
        }
      }
      return final;
    },
    [slug, poll],
  );

  const reset = React.useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState(INITIAL);
  }, []);

  return { state, generate, reset };
}
