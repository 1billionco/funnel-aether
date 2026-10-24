/**
 * Output types and channel specs (spec §6.3 layer 4). Token caps keep p95
 * completion well inside the synchronous function limit for streamed types;
 * long-form types run as background jobs (spec §3).
 */
export type OutputType = "social_post" | "email" | "whatsapp" | "landing_copy" | "seo_brief";
export type Channel = "linkedin" | "instagram" | "facebook" | "x" | "email" | "whatsapp" | "web";

export interface OutputSpec {
  type: OutputType;
  label: string;
  description: string;
  channels: Channel[];
  mode: "stream" | "background";
  maxTokens: number;
  typicalTokens: number;
  defaultVariants: number;
  maxVariants: number;
  longForm: boolean;
}

export const OUTPUT_TYPES: Record<OutputType, OutputSpec> = {
  social_post: {
    type: "social_post",
    label: "Social post",
    description: "LinkedIn, Instagram, Facebook or X",
    channels: ["linkedin", "instagram", "facebook", "x"],
    mode: "stream",
    maxTokens: 900,
    typicalTokens: 450,
    defaultVariants: 2,
    maxVariants: 3,
    longForm: false,
  },
  whatsapp: {
    type: "whatsapp",
    label: "WhatsApp message",
    description: "Broadcast, Status or a reply you can send",
    channels: ["whatsapp"],
    mode: "stream",
    maxTokens: 700,
    typicalTokens: 350,
    defaultVariants: 2,
    maxVariants: 3,
    longForm: false,
  },
  email: {
    type: "email",
    label: "Email",
    description: "Newsletter, offer or follow-up",
    channels: ["email"],
    mode: "stream",
    maxTokens: 1400,
    typicalTokens: 700,
    defaultVariants: 1,
    maxVariants: 2,
    longForm: false,
  },
  landing_copy: {
    type: "landing_copy",
    label: "Landing page copy",
    description: "Headline, sections and call to action",
    channels: ["web"],
    mode: "background",
    maxTokens: 2500,
    typicalTokens: 1600,
    defaultVariants: 1,
    maxVariants: 1,
    longForm: true,
  },
  seo_brief: {
    type: "seo_brief",
    label: "SEO brief",
    description: "Keywords, outline and questions to answer",
    channels: ["web"],
    mode: "background",
    maxTokens: 2200,
    typicalTokens: 1400,
    defaultVariants: 1,
    maxVariants: 1,
    longForm: true,
  },
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X (Twitter)",
  email: "Email",
  whatsapp: "WhatsApp",
  web: "Website",
};

/** Character limits used in prompts and brand-match length checks. */
export const CHANNEL_LIMITS: Record<Channel, number> = {
  linkedin: 3000,
  instagram: 2200,
  facebook: 2000,
  x: 280,
  email: 6000,
  whatsapp: 1000,
  web: 12000,
};

export function channelGuidance(channel: Channel, market: "UK" | "NG"): string {
  switch (channel) {
    case "linkedin":
      return "LinkedIn post: strong first line (it shows before 'see more'), short paragraphs, 120–220 words, up to 3 relevant hashtags at the end, one clear call to action.";
    case "instagram":
      return "Instagram caption: hook in the first line, friendly and visual, 60–150 words, emojis sparingly, 5–10 hashtags at the end, call to action.";
    case "facebook":
      return "Facebook post: conversational, 60–150 words, one call to action, at most 2 hashtags.";
    case "x":
      return "X post: under 280 characters including hashtags; one idea; one call to action.";
    case "whatsapp":
      return `WhatsApp message: short lines, under 600 characters, WhatsApp formatting (*bold*, _italic_), up to 3 emojis, plain prices in ${market === "NG" ? "naira (₦)" : "pounds (£)"}, ends with a simple way to reply or order. No hashtags. No links unless the brief provides one.`;
    case "email":
      return "Email: write the body only (greeting, 120–250 words, one call to action, sign-off with the business name). Put the subject line and preheader in the META fields. No unsubscribe footer (we add it).";
    case "web":
      return "Website copy: use Markdown headings (##), short paragraphs and bullet points.";
  }
}

/** More versions in one call need more output room; estimates scale the same way. */
export function tokensFor(spec: OutputSpec, variants: number) {
  const scale = 1 + 0.6 * (Math.max(1, Math.min(spec.maxVariants, variants)) - 1);
  return {
    max: Math.round(spec.maxTokens * scale),
    typical: Math.round(spec.typicalTokens * scale),
  };
}
