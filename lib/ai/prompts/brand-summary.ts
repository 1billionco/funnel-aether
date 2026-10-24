import type { RetrievedChunk } from "../../brand-voice/retrieve";
import type { GenRequest } from "../provider";
import {
  brandProfileBlock,
  describeTone,
  ROLE_AND_SAFETY,
  samplesBlock,
  type BrandForPrompt,
  type OrgForPrompt,
} from "./brand";

export const SUMMARY_MAX_TOKENS = 500;

/** Prompt for the onboarding brand summary the owner approves (spec §7.4 #10). */
export function brandSummaryRequest(input: {
  model: string;
  brand: BrandForPrompt;
  org: OrgForPrompt;
  chunks: RetrievedChunk[];
}): Omit<GenRequest, "signal"> {
  const { brand, org, chunks } = input;
  return {
    model: input.model,
    tier: "fast",
    maxTokens: SUMMARY_MAX_TOKENS,
    system: [
      { text: ROLE_AND_SAFETY, cacheable: false },
      { text: brandProfileBlock({ ...brand, summary: null }, org) },
      { text: samplesBlock(chunks) },
    ],
    messages: [
      {
        role: "user",
        content:
          'Write a brand voice summary for the owner to approve. 90 to 140 words, second person ("You sound…"), plain English, no headings or bullet points. Cover: who you talk to, how you sound, words you favour and avoid, and how you usually ask customers to act. Base it only on the brand profile and samples. Return just the summary.',
      },
    ],
    mockOutput: () => mockSummary(brand, org),
  };
}

export function mockSummary(brand: BrandForPrompt, org: OrgForPrompt): string {
  const tone = describeTone(brand.tone_sliders);
  const audience = brand.audience ? brand.audience.replace(/\.$/, "") : "your customers";
  const offer = brand.offer ? brand.offer.replace(/\.$/, "").toLowerCase() : "what you offer";
  const avoid = brand.dont_say.length
    ? ` You steer clear of words like ${brand.dont_say
        .slice(0, 3)
        .map((w) => `"${w}"`)
        .join(", ")}.`
    : "";
  const likes = brand.do_say.length
    ? ` You lean on phrases such as ${brand.do_say
        .slice(0, 3)
        .map((w) => `"${w}"`)
        .join(", ")}.`
    : "";
  const cta =
    brand.example_ctas[0] ?? (org.market === "NG" ? "Send us a WhatsApp" : "Book a quick call");
  return `You talk to ${audience} about ${offer}. You sound ${tone}, and you get to the point without jargon.${likes}${avoid} You write in ${org.market === "UK" ? "British" : "Nigerian"} English and quote prices in ${org.currency === "GBP" ? "pounds" : "naira"}. You end with a clear, friendly next step such as "${cta}". You never overpromise: you say what ${brand.name} does well and let customers decide.`;
}
