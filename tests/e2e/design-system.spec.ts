import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("design system page", () => {
  test("renders tokens and components", async ({ page }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { level: 1, name: "Calm control" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(page.getByTestId("service-modes")).toContainText("llm: mock");
  });

  test("theme toggle switches to dark and persists", async ({ page }) => {
    await page.goto("/dev/ui");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(paper).toBe("rgb(17, 19, 24)");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no WCAG A/AA violations (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("fa-theme", t), theme);
      await page.goto("/dev/ui");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`),
      ).toEqual([]);
    });
  }

  test("has no horizontal overflow at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/dev/ui");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("security headers", () => {
  test("app pages refuse framing; hosted forms allow it", async ({ request }) => {
    const home = await request.get("/");
    expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(home.headers()["x-content-type-options"]).toBe("nosniff");
    expect(home.headers()["strict-transport-security"]).toContain("max-age=");
    const form = await request.get("/f/does-not-exist");
    expect(form.headers()["content-security-policy"]).toContain("frame-ancestors *");
    expect(form.headers()["x-frame-options"]).toBeUndefined();
  });
});
