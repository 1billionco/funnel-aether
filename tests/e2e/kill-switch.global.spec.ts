import { expect, test } from "@playwright/test";

import { onboardedTenant, serviceClient, signInWithPassword } from "./fixtures";

// Global setting: runs in its own project after the parallel suites (playwright.config.ts).
test("the kill switch blocks generation with a friendly message", async ({ page }) => {
  const t = await onboardedTenant("killswitch");
  const svc = serviceClient();
  await svc.from("app_settings").update({ ai_kill_switch: true }).eq("id", true);
  try {
    await signInWithPassword(page, t.email);
    await page.goto(`/${t.org.slug}/create`);
    await page.getByLabel("What should it achieve?").fill("Anything");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("AI drafting is paused for today")).toBeVisible();
    const { count } = await svc
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", t.org.id);
    expect(count).toBe(0);
    const { data: org } = await svc
      .from("organizations")
      .select("credit_balance_milli")
      .eq("id", t.org.id)
      .single();
    expect(org!.credit_balance_milli).toBe(15_000);
  } finally {
    await svc.from("app_settings").update({ ai_kill_switch: false }).eq("id", true);
  }
});
