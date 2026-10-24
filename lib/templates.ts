import type { Channel, OutputType } from "./ai/output-types";

/** Starter briefs tuned per market (spec §7.4 #3). */
export interface Template {
  id: string;
  market: "UK" | "NG" | "ANY";
  title: string;
  description: string;
  type: OutputType;
  channel: Channel;
  goal: string;
  details?: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "ng-weekend-whatsapp",
    market: "NG",
    title: "Weekend promo for WhatsApp Status",
    description: "Short, punchy and easy to forward.",
    type: "whatsapp",
    channel: "whatsapp",
    goal: "Announce this weekend's promo and get customers to message us to order",
    details: "Mention delivery options and how to pay.",
  },
  {
    id: "ng-new-stock",
    market: "NG",
    title: "New stock just arrived",
    description: "Broadcast to your customer list.",
    type: "whatsapp",
    channel: "whatsapp",
    goal: "Tell customers about new stock that just arrived",
  },
  {
    id: "ng-instagram-product",
    market: "NG",
    title: "Instagram product post",
    description: "Caption with hashtags for a product photo.",
    type: "social_post",
    channel: "instagram",
    goal: "Show off one of our best-selling products and invite people to order",
  },
  {
    id: "ng-thank-you",
    market: "NG",
    title: "Thank-you message after a sale",
    description: "Builds loyalty and repeat orders.",
    type: "whatsapp",
    channel: "whatsapp",
    goal: "Thank a customer for their purchase and invite them to come back",
  },
  {
    id: "uk-linkedin-insight",
    market: "UK",
    title: "LinkedIn insight post for accountants",
    description: "Share a useful tip that shows expertise.",
    type: "social_post",
    channel: "linkedin",
    goal: "Share one practical tip small business owners often miss, and invite them to get in touch",
    details: "Keep it helpful, not salesy.",
  },
  {
    id: "uk-deadline-email",
    market: "UK",
    title: "Client reminder: tax deadline",
    description: "Friendly reminder email to clients.",
    type: "email",
    channel: "email",
    goal: "Remind clients about the upcoming self assessment deadline and what we need from them",
  },
  {
    id: "uk-newsletter",
    market: "UK",
    title: "Monthly newsletter email",
    description: "News, a tip and a call to action.",
    type: "email",
    channel: "email",
    goal: "Share this month's news and one useful tip, and invite readers to book a call",
  },
  {
    id: "uk-landing-consult",
    market: "UK",
    title: "Landing page: free consultation",
    description: "Turn visitors into booked calls.",
    type: "landing_copy",
    channel: "web",
    goal: "Convince small business owners to book a free 20-minute consultation",
  },
  {
    id: "any-facebook-offer",
    market: "ANY",
    title: "Facebook post about an offer",
    description: "Friendly post for your page.",
    type: "social_post",
    channel: "facebook",
    goal: "Tell followers about our current offer",
  },
  {
    id: "any-seo-brief",
    market: "ANY",
    title: "SEO brief for a service page",
    description: "Keywords and outline for your website.",
    type: "seo_brief",
    channel: "web",
    goal: "Plan a service page that ranks for our main service in our area",
  },
];

export function templatesFor(market: "UK" | "NG") {
  return TEMPLATES.filter((t) => t.market === market || t.market === "ANY");
}
