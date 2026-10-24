/** Maps database/auth error codes to plain-English messages (§7.5). */
const MESSAGES: Record<string, string> = {
  signups_closed:
    "We're not taking new sign-ups right now. Join the waitlist and we'll be in touch.",
  invite_required: "You need an invite code to join the beta.",
  invite_invalid: "That invite code isn't valid or has been used up.",
  invite_wrong_market: "That invite code is for a different country.",
  already_owns_org: "You already have a business set up. Open it from the menu.",
  beta_full: "The beta is full for now. Join the waitlist and we'll be in touch.",
  market_locked: "Your country is locked after your first payment.",
  invalid_name: "Enter your business name.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  invalid_credentials: "That email and password don't match. Try again or use an email link.",
  not_configured: "Sign-in isn't set up on this server yet (no database connected).",
};

export function friendlyError(codeOrMessage: string | undefined | null): string {
  if (!codeOrMessage) return "Something went wrong. Please try again.";
  for (const [code, message] of Object.entries(MESSAGES)) {
    if (codeOrMessage.includes(code)) return message;
  }
  if (/invalid login credentials/i.test(codeOrMessage)) return MESSAGES.invalid_credentials!;
  if (/already registered/i.test(codeOrMessage))
    return "You already have an account. Sign in instead.";
  return "Something went wrong. Please try again.";
}
