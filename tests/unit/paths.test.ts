import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/paths";
import { safeNextPath } from "@/lib/auth/safe-next";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/sign-in",
    "/sign-up",
    "/auth/callback",
    "/f/hartley",
    "/dev/ui",
    "/api/webhooks/stripe",
  ])("%s is public", (p) => expect(isPublicPath(p)).toBe(true));
  it.each(["/onboarding", "/admin", "/hartley-co/today", "/foo", "/fancy-org/review", "/authors"])(
    "%s needs a session",
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});

describe("safeNextPath", () => {
  it("keeps internal paths", () =>
    expect(safeNextPath("/acme/review?x=1")).toBe("/acme/review?x=1"));
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "",
    null,
    undefined,
    "javascript:alert(1)",
  ])("rejects %s", (p) => expect(safeNextPath(p, "/home")).toBe("/home"));
});
