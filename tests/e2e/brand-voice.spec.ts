import { expect, test } from "@playwright/test";

import {
  createUserWithOrg,
  expectNoHorizontalOverflow,
  serviceClient,
  signInWithPassword,
} from "./fixtures";

const SAMPLE = `Weekend promo at Chinedu Electronics! Samsung phones and LG fridges are in stock.
Free delivery across Lagos mainland. Send us a WhatsApp and we'll sort you out quickly.
We keep things simple: fair prices, real warranties, friendly service.`;

test("onboarding: add samples, approve the brand summary, see the score", async ({ page }) => {
  const t = await createUserWithOrg("bv", "NG");
  await serviceClient()
    .from("brands")
    .update({
      offer: "Phones and home appliances",
      audience: "Families in Lagos",
      dont_say: ["cheap"],
    })
    .eq("id", t.brand.id);
  await serviceClient()
    .from("profiles")
    .update({ onboarding_state: { org_id: t.org.id, step: "samples" } })
    .eq("user_id", t.id);

  await signInWithPassword(page, t.email);
  await expect(page).toHaveURL(/\/setup\/samples$/);
  await expectNoHorizontalOverflow(page);

  // Paste tab is the default during onboarding.
  await page.getByLabel("Paste a few past posts, emails or messages").fill(SAMPLE);
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByText("Added. We're reading it now.")).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 20_000 });

  // A private address is refused by the SSRF guard.
  await page.getByRole("tab", { name: "Website" }).click();
  await page.getByLabel("Web page").fill("http://127.0.0.1:54321/");
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("That address isn't allowed.")).toBeVisible();

  // Upload a real file straight to Storage via the signed URL.
  await page.getByRole("tab", { name: "Upload" }).click();
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "emails.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Hello from Chinedu. Our new TVs just landed, come and see them this Saturday. Send a WhatsApp to reserve one.",
    ),
  });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("emails.txt")).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toHaveCount(2, { timeout: 20_000 });

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/setup\/summary$/);
  await page.getByRole("button", { name: "Write my brand summary" }).click();
  const summary = page.getByLabel("Your brand summary");
  await expect(summary).toHaveValue(/You talk to Families in Lagos/);
  await expect(page.getByText("Needs your approval")).toBeVisible();
  await summary.fill(
    "You talk to families in Lagos about phones and appliances. You sound warm and quick, and you always offer a WhatsApp chat.",
  );
  await page.getByRole("button", { name: "Approve summary" }).click();
  await expect(page.getByText("Approved by you")).toBeVisible();

  const svc = serviceClient();
  const { data: brand } = await svc
    .from("brands")
    .select("summary_status, summary, document_count, training_quality_score")
    .eq("id", t.brand.id)
    .single();
  expect(brand?.summary_status).toBe("approved");
  expect(brand?.summary).toContain("WhatsApp chat");
  expect(brand?.document_count).toBe(2);
  expect(brand?.training_quality_score).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto(`/${t.org.slug}/brand`);
  await expect(page.getByTestId("quality-score")).toHaveText(String(brand?.training_quality_score));
  await expect(page.getByText("Approved by you")).toBeVisible();
});
