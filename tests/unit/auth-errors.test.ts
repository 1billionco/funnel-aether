import { describe, expect, it } from "vitest";

import { friendlyError } from "@/lib/auth/errors";

describe("friendlyError", () => {
  it("maps Supabase auth error codes and messages", () => {
    expect(friendlyError("email_not_confirmed")).toMatch(/Confirm your email first/);
    expect(friendlyError("Email not confirmed")).toMatch(/Confirm your email first/);
    expect(friendlyError("invalid_credentials")).toMatch(/don't match/);
    expect(friendlyError("link_other_browser")).toMatch(/Your email is confirmed/);
    expect(friendlyError("link_expired")).toMatch(/expired or was already used/);
    expect(friendlyError("Email link is invalid or has expired")).toMatch(/expired/);
  });

  it("falls back to a generic message", () => {
    expect(friendlyError("something odd")).toBe("Something went wrong. Please try again.");
    expect(friendlyError(undefined)).toBe("Something went wrong. Please try again.");
  });
});
