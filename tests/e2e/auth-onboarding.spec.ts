import { expect, test } from "@playwright/test";

import {
  choosePasswordTab,
  createInvite,
  createUser,
  expectNoHorizontalOverflow,
  onboardedTenant,
  serviceClient,
  signInWithPassword,
} from "./fixtures";

test.describe("sign-up and onboarding", () => {
  test("a new Nigerian business signs up and completes onboarding", async ({ page }) => {
    const code = await createInvite();
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    await page.getByRole("link", { name: "Join with an invite code" }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    await choosePasswordTab(page);
    await page.getByLabel("Your name").fill("Chinedu Okafor");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-strong-password-1");
    await page.getByLabel(/Invite code/).fill(code);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Let's set up your business" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByText("Nigeria", { exact: true }).click();
    await page.getByLabel("Business name").fill("Chinedu Electronics");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/setup\/brand$/);
    await expectNoHorizontalOverflow(page);
    await page
      .getByLabel("What do you sell?")
      .fill("Phones, TVs and home appliances with delivery in Lagos");
    await page
      .getByLabel("Who are your customers?")
      .fill("Young families and small shop owners in Lagos");
    await page.getByLabel("Words to avoid").fill("cheap, guaranteed");
    await page.getByRole("button", { name: "Continue" }).click();

    // Remaining steps are skippable.
    for (const step of ["samples", "summary", "first-draft"]) {
      await expect(page).toHaveURL(new RegExp(`/setup/${step}$`));
      await page.getByRole("button", { name: "Skip for now" }).click();
    }

    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Good (morning|afternoon|evening), Chinedu/,
    );
    await expectNoHorizontalOverflow(page);

    // NG orgs default to Lite mode on first visit: no web-font variables on <html>.
    expect(await page.locator("html").getAttribute("data-lite")).not.toBeNull();

    const svc = serviceClient();
    const { data: org } = await svc
      .from("organizations")
      .select("id, currency, onboarding_completed_at")
      .eq("name", "Chinedu Electronics")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(org?.currency).toBe("NGN");
    expect(org?.onboarding_completed_at).not.toBeNull();
    const { data: brand } = await svc
      .from("brands")
      .select("dont_say")
      .eq("org_id", org!.id)
      .single();
    expect(brand?.dont_say).toEqual(["cheap", "guaranteed"]);
    const { data: events } = await svc.from("events").select("name").eq("org_id", org!.id);
    expect(events?.map((e) => e.name)).toEqual(
      expect.arrayContaining(["onboarding_started", "onboarding_completed"]),
    );
  });

  test("sign-up without an invite code is refused in invite mode", async ({ page }) => {
    await page.goto("/sign-up");
    await choosePasswordTab(page);
    await page.getByLabel("Email").fill(`noinvite-${Date.now()}@example.test`);
    await page.getByLabel("Password").fill("a-strong-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("You need an invite code to join the beta.")).toBeVisible();
  });
});

test.describe("access control", () => {
  test("signed-out visitors are sent to sign-in and back", async ({ page }) => {
    const t = await onboardedTenant("redirect");
    await page.goto(`/${t.org.slug}/today`);
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2F${t.org.slug}%2Ftoday`));
    await choosePasswordTab(page);
    await page.getByLabel("Email").fill(t.email);
    await page.getByLabel("Password").fill("correct-horse-battery-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/${t.org.slug}/today$`));
  });

  test("a user cannot open another business's pages", async ({ page }) => {
    const owner = await onboardedTenant("victim");
    const other = await onboardedTenant("other");
    await signInWithPassword(page, other.email);
    await expect(page).toHaveURL(new RegExp(`/${other.org.slug}/today$`));
    for (const path of ["today", "brand", "settings", "setup/brand"]) {
      const res = await page.goto(`/${owner.org.slug}/${path}`);
      expect(res?.status(), path).toBe(404);
    }
    await expect(page.getByText(owner.org.name)).toHaveCount(0);
  });

  test("non-founders get a 404 for /admin", async ({ page }) => {
    const u = await createUser("notfounder");
    await signInWithPassword(page, u.email);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });
});

test.describe("app shell", () => {
  test("shows the navigation and saves the brand", async ({ page, isMobile }) => {
    const t = await onboardedTenant("shell");
    await signInWithPassword(page, t.email);
    await expect(page).toHaveURL(/\/today$/);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Review" })).toBeVisible();
    if (isMobile) await expect(nav.getByRole("button", { name: "More" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/${t.org.slug}/brand`);
    await page.getByLabel("Words and phrases to use").fill("friendly, clear");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    const { data } = await serviceClient()
      .from("brands")
      .select("do_say")
      .eq("id", t.brand.id)
      .single();
    expect(data?.do_say).toEqual(["friendly", "clear"]);
  });

  test("lite mode can be switched on from settings", async ({ page }) => {
    const t = await onboardedTenant("lite");
    await signInWithPassword(page, t.email);
    await page.goto(`/${t.org.slug}/settings`);
    expect(await page.locator("html").getAttribute("data-lite")).toBeNull();
    await page.getByRole("switch", { name: "Lite mode" }).click();
    await expect.poll(async () => page.locator("html").getAttribute("data-lite")).not.toBeNull();
  });
});
