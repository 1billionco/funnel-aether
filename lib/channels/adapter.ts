/**
 * Channel adapter (spec §2, §15). Email sends for real (Resend). WhatsApp and
 * social produce approved, ready-to-post assets; API posting is a later adapter.
 * Every delivery requires an approved draft (AI proposes, the human approves).
 */
export type ChannelId = "email" | "whatsapp" | "linkedin" | "instagram" | "facebook";

export type DeliveryResult =
  | { kind: "sent"; providerMessageId: string; isMock: boolean }
  | { kind: "asset"; copy: string; shareUrl?: string };

export interface ApprovedDraftRef {
  draftId: string;
  orgId: string;
  approvedAt: string;
}

export interface ChannelAdapter {
  readonly channel: ChannelId;
  /** True when this adapter delivers via an API; false when it only prepares assets. */
  readonly canAutoDeliver: boolean;
  deliver(draft: ApprovedDraftRef, payload: Record<string, unknown>): Promise<DeliveryResult>;
}
