import type { RetrievedChunk } from "../../brand-voice/retrieve";
import { META_MARK, VARIANT_MARK } from "../output-parser";
import {
  channelGuidance,
  OUTPUT_TYPES,
  tokensFor,
  type Channel,
  type OutputType,
} from "../output-types";
import type { GenRequest, ModelTier } from "../provider";
import {
  brandProfileBlock,
  briefBlock,
  ROLE_AND_SAFETY,
  samplesBlock,
  type BrandForPrompt,
  type OrgForPrompt,
} from "./brand";

export interface Brief {
  goal: string;
  offer?: string;
  audience?: string;
  details?: string;
}

export interface ContentRequestInput {
  model: string;
  tier: ModelTier;
  type: OutputType;
  channel: Channel;
  variants: number;
  brief: Brief;
  brand: BrandForPrompt;
  org: OrgForPrompt;
  chunks: RetrievedChunk[];
  /** Regenerate-with-feedback: the previous version and what to change. */
  previous?: { body: string; feedback: string };
  /** Continue a partial draft. */
  continueFrom?: string;
}

function outputContract(type: OutputType, variants: number): string {
  const metaFields =
    type === "email"
      ? '{"title": "short internal title", "subject": "subject line under 60 characters", "preheader": "preview text under 90 characters", "cta": "the call to action", "flags": []}'
      : type === "social_post"
        ? '{"title": "short internal title", "hashtags": ["#Example"], "cta": "the call to action", "flags": []}'
        : '{"title": "short internal title", "cta": "the call to action", "flags": []}';
  return [
    `Write ${variants === 1 ? "one version" : `${variants} distinct versions`} of the content.`,
    variants > 1 ? `Separate versions with a line containing only ${VARIANT_MARK}` : null,
    `After the content, write a line containing only ${META_MARK} followed by a single JSON object: ${metaFields}`,
    `"flags" lists concerns the owner should check before approving, each as {"type": "fabricated_testimonial" | "fake_scarcity" | "regulated_claim" | "other", "message": "plain-English explanation"}. Use [] when there are none.`,
    "Do not add any commentary before the content or after the JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Assembles the 5 prompt layers (spec §6.3). */
export function contentRequest(i: ContentRequestInput): Omit<GenRequest, "signal"> {
  const spec = OUTPUT_TYPES[i.type];
  const task = [
    `Task: ${spec.label} for ${i.channel}.`,
    channelGuidance(i.channel, i.org.market),
    i.type === "landing_copy"
      ? "Structure: headline, subheadline, 3 benefit sections, a short FAQ (3 questions), and a closing call to action."
      : null,
    i.type === "seo_brief"
      ? "Structure: target keyword and 5 related keywords, search intent, suggested title tag and meta description, an H2/H3 outline, questions to answer, and internal links to consider. Do not invent statistics."
      : null,
    outputContract(i.type, i.variants),
  ]
    .filter(Boolean)
    .join("\n\n");

  const brief = [
    `Goal: ${i.brief.goal}`,
    i.brief.offer ? `Offer or product: ${i.brief.offer}` : null,
    i.brief.audience ? `Audience: ${i.brief.audience}` : null,
    i.brief.details ? `Details: ${i.brief.details}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: GenRequest["messages"] = [
    { role: "user", content: `${task}\n\n${briefBlock(brief)}` },
  ];
  if (i.previous) {
    messages.push(
      { role: "assistant", content: i.previous.body },
      {
        role: "user",
        content: `Rewrite it with this feedback from the owner:\n${briefBlock(i.previous.feedback)}\n\nFollow the same output format.`,
      },
    );
  }
  if (i.continueFrom) {
    messages.push({
      role: "user",
      content: `Your previous answer was cut off. Here is what you wrote so far:\n\n${i.continueFrom}\n\nContinue from exactly where it stopped, then finish with the ${META_MARK} JSON. Do not repeat what's already written.`,
    });
  }

  return {
    model: i.model,
    tier: i.tier,
    maxTokens: tokensFor(spec, i.variants).max,
    system: [
      { text: `${ROLE_AND_SAFETY}\n\n${brandProfileBlock(i.brand, i.org)}`, cacheable: true },
      { text: samplesBlock(i.chunks) },
    ],
    messages,
    mockOutput: () => mockContent(i),
  };
}

// ---------------------------------------------------------------- mock generator

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic, brand-shaped placeholder copy so the whole flow works with no API key. */
export function mockContent(i: ContentRequestInput): string {
  const seed = hash(`${i.brief.goal}|${i.channel}|${i.previous?.feedback ?? ""}`);
  const name = i.brand.name;
  const offer = i.brief.offer || i.brand.offer || "what we do";
  const audience = i.brief.audience || i.brand.audience || "you";
  const cta =
    i.brand.example_ctas[0] ??
    (i.org.market === "NG" ? "Send us a WhatsApp to order" : "Book a free 20-minute call");
  const price = i.org.currency === "NGN" ? "₦" : "£";
  const feedbackNote = i.previous ? ` (${i.previous.feedback.slice(0, 60)})` : "";

  const variants: string[] = [];
  for (let v = 0; v < i.variants; v++) {
    const opener = pick(
      i.org.market === "NG"
        ? ["Good news for", "Hello", "This weekend at", "Fresh in at"]
        : ["A quick note for", "If you're one of", "Here's something for", "Three things for"],
      seed + v,
    );
    switch (i.type) {
      case "whatsapp":
        variants.push(
          `*${opener} ${name}!* 🎉\n\n${i.brief.goal}.\n\n${offer}, with friendly service and fair prices in ${price}.\n\n👉 ${cta}.${feedbackNote}`,
        );
        break;
      case "email":
        variants.push(
          `Hi there,\n\n${opener} ${audience}: ${i.brief.goal.toLowerCase()}.\n\nAt ${name} we focus on ${offer.toLowerCase()}, explained in plain English so you always know where you stand.\n\n${cta} and we'll take it from there.${feedbackNote}\n\nBest wishes,\nThe ${name} team`,
        );
        break;
      case "landing_copy":
        variants.push(
          `## ${i.brief.goal}\n\n${name} helps ${audience} with ${offer.toLowerCase()}.\n\n### Why people choose us\n- Clear, honest advice\n- Friendly and quick to reply\n- Prices in ${price}, no surprises\n\n### Questions\n**How do I start?** ${cta}.\n**Who is it for?** ${audience}.\n**What does it cost?** Ask us for a quote.\n\n**${cta}.**${feedbackNote}`,
        );
        break;
      case "seo_brief":
        variants.push(
          `## Target keyword\n${offer.toLowerCase()}\n\n## Search intent\nPeople looking for ${offer.toLowerCase()} near them.\n\n## Outline\n### What ${name} offers\n### Who it's for\n### How to get started\n\n## Questions to answer\n- How much does it cost?\n- How quickly can you help?${feedbackNote}`,
        );
        break;
      default:
        variants.push(
          `${opener} ${audience}.\n\n${i.brief.goal}. At ${name}, ${offer.toLowerCase()} is what we do every day, and we keep it simple.\n\n${cta}.${feedbackNote}`,
        );
    }
  }
  const meta = {
    title: i.brief.goal.slice(0, 60),
    ...(i.type === "email"
      ? { subject: i.brief.goal.slice(0, 55), preheader: `From ${name}: ${offer}`.slice(0, 90) }
      : {}),
    ...(i.type === "social_post"
      ? {
          hashtags: [
            `#${name.replace(/[^A-Za-z0-9]/g, "")}`,
            i.org.market === "NG" ? "#Lagos" : "#SmallBusiness",
          ],
        }
      : {}),
    cta,
    flags: [],
  };
  return `${variants.join(`\n${VARIANT_MARK}\n`)}\n${META_MARK}\n${JSON.stringify(meta)}`;
}
