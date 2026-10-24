import { expect, test, type Page } from "@playwright/test";

import { onboardedTenant, serviceClient, signInWithPassword } from "./fixtures";

async function generateFromCreate(page: Page, slug: string, goal: string) {
  await page.goto(`/${slug}/create`);
  await page.getByLabel("What should it achieve?").fill(goal);
  // Mock: ¼-credit minimum, shown to one decimal (rounded down).
  await expect(page.getByTestId("credit-estimate")).toHaveText("0.2");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByRole("link", { name: "Open in Review" })).toBeVisible({ timeout: 20_000 });
}

test("generate → edit → approve, with credits and audit trail", async ({ page }) => {
  const t = await onboardedTenant("studio");
  await signInWithPassword(page, t.email);
  const svc = serviceClient();
  const before = (
    await svc.from("organizations").select("credit_balance_milli").eq("id", t.org.id).single()
  ).data!.credit_balance_milli;

  await generateFromCreate(page, t.org.slug, "Share a tip about keeping receipts");
  await expect(page.getByText("Drafted by AI").first()).toBeVisible();
  await expect(page.getByText("Mock output").first()).toBeVisible();
  await expect(page.getByText(/Used\s*0\.2\s*credits/)).toBeVisible();

  const after = (
    await svc.from("organizations").select("credit_balance_milli").eq("id", t.org.id).single()
  ).data!.credit_balance_milli;
  expect(before - after).toBe(250);

  await page.getByRole("link", { name: "Open in Review" }).click();
  await expect(page.getByText("Waiting for you").first()).toBeVisible();
  // Review badge in the nav shows the pending count.
  await expect(
    page.getByLabel("1 waiting for you").filter({ visible: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Edit/ }).click();
  const editor = page.getByLabel("Draft", { exact: true });
  await editor.fill(
    "Keep every receipt in one folder. It saves hours at year end. Book a free call and we'll show you how.",
  );
  await page.getByRole("button", { name: /Save and approve/ }).click();
  await expect(page.getByText("Approved. Nothing has been sent or posted.")).toBeVisible();

  const { data: draft } = await svc
    .from("drafts")
    .select("id, status, body, approved_by")
    .eq("org_id", t.org.id)
    .single();
  expect(draft!.status).toBe("approved");
  expect(draft!.approved_by).toBe(t.id);
  expect(draft!.body).toContain("Keep every receipt");
  const { data: versions } = await svc
    .from("draft_versions")
    .select("source")
    .eq("draft_id", draft!.id)
    .order("version");
  expect(versions!.map((v) => v.source)).toEqual(["ai", "human_edit"]);
  const { data: audit } = await svc
    .from("approval_events")
    .select("action")
    .eq("draft_id", draft!.id)
    .order("at");
  expect(audit!.map((a) => a.action)).toEqual(["edit", "approve"]);
  const { data: events } = await svc.from("events").select("name").eq("org_id", t.org.id);
  expect(events!.map((e) => e.name)).toEqual(
    expect.arrayContaining(["draft_generated", "draft_approved", "draft_edited_before_approve"]),
  );
});

test("reject with a reason, then regenerate with feedback", async ({ page, isMobile }) => {
  test.skip(isMobile, "covered on desktop; mobile swipe has its own test");
  const t = await onboardedTenant("reject");
  await signInWithPassword(page, t.email);
  await generateFromCreate(page, t.org.slug, "Announce our new payroll service");
  await page.getByRole("link", { name: "Open in Review" }).click();

  // Keyboard: G opens regenerate.
  await page.getByRole("heading", { level: 2 }).first().click();
  await page.keyboard.press("g");
  await page.getByLabel("What should change?").fill("Make it shorter and warmer");
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(page.getByText("New version ready for review.")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /2 versions/ }).click();
  await expect(page.getByLabel("Version history")).toContainText("AI rewrite");

  await page.getByRole("button", { name: /^Reject/ }).click();
  await page.getByLabel("Reason (optional)").fill("Not the right moment");
  await page.getByRole("dialog").getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Rejected.", { exact: true })).toBeVisible();

  const { data: d } = await serviceClient()
    .from("drafts")
    .select("status, rejected_reason")
    .eq("org_id", t.org.id)
    .single();
  expect(d).toEqual({ status: "rejected", rejected_reason: "Not the right moment" });
});

test("mobile: swipe right to approve, with undo", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch gesture");
  const t = await onboardedTenant("swipe", "NG");
  await signInWithPassword(page, t.email);
  await page.goto(`/${t.org.slug}/create?template=ng-weekend-whatsapp`);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByTestId("preview-whatsapp").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Review" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/${t.org.slug}/review`);
  const card = page
    .getByRole("navigation", { name: "Drafts", exact: true })
    .getByRole("link")
    .first();
  await expect(card).toBeVisible();
  // A real touch gesture via the DevTools protocol (the browser turns it into pointer events).
  const box = (await card.boundingBox())!;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 20, y }],
  });
  for (const dx of [20, 60, 120, 180])
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + 20 + dx, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByText("Approved.", { exact: true })).toBeVisible();
  const svc = serviceClient();
  await expect
    .poll(
      async () =>
        (await svc.from("drafts").select("status").eq("org_id", t.org.id).single()).data!.status,
    )
    .toBe("approved");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(
      async () =>
        (await svc.from("drafts").select("status").eq("org_id", t.org.id).single()).data!.status,
    )
    .toBe("pending");
});

test("onboarding finishes with a first draft waiting in Review", async ({ page }) => {
  const t = await onboardedTenant("firstdraft", "UK");
  const svc = serviceClient();
  await svc.from("organizations").update({ onboarding_completed_at: null }).eq("id", t.org.id);
  await svc
    .from("profiles")
    .update({ onboarding_state: { org_id: t.org.id, step: "first-draft" } })
    .eq("user_id", t.id);
  await signInWithPassword(page, t.email);
  await expect(page).toHaveURL(/\/setup\/first-draft$/);
  await expect(page.getByLabel("What should it achieve?")).toHaveValue(/practical tip/);
  await page.getByRole("button", { name: "Generate" }).click();
  await page.getByRole("button", { name: "Review and approve it" }).click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/review\?welcome=1$/);
  await expect(page.getByText("Your first draft is ready.")).toBeVisible();
  const { data: org } = await svc
    .from("organizations")
    .select("onboarding_completed_at")
    .eq("id", t.org.id)
    .single();
  expect(org!.onboarding_completed_at).not.toBeNull();
});
