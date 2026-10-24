import { expect, type Page } from "@playwright/test";

import {
  TEST_PASSWORD,
  createInvite,
  createUser,
  createUserWithOrg,
  serviceClient,
} from "../support/supabase";

export { TEST_PASSWORD, createInvite, createUser, createUserWithOrg, serviceClient };

/** Client-side tabs only respond after hydration, so retry until the tab is selected. */
export async function choosePasswordTab(page: Page) {
  const tab = page.getByRole("tab", { name: "Password" });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

export async function signInWithPassword(
  page: Page,
  email: string,
  password = TEST_PASSWORD,
  next?: string,
) {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  await choosePasswordTab(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });
}

/** A user whose org has finished onboarding (lands on Today). */
export async function onboardedTenant(tag: string, market: "UK" | "NG" = "UK") {
  const t = await createUserWithOrg(tag, market);
  const svc = serviceClient();
  await svc
    .from("brands")
    .update({ offer: "Bookkeeping and tax returns", audience: "Small firms in Kent" })
    .eq("id", t.brand.id);
  await svc
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", t.org.id);
  return t;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Latest auth link sent to `email`, read from the local stack's Mailpit. */
export async function latestEmailLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
        Text: string;
      };
      const link = msg.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\S+/)?.[0];
      if (link) return link.replace(/[)>]+$/, "");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No auth email for ${email}`);
}
