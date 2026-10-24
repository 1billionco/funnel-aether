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
