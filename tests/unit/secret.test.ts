import { describe, expect, it } from "vitest";

import { verifySharedSecret } from "@/lib/jobs/secret";

describe("verifySharedSecret", () => {
  it("accepts only an exact match", () => {
    expect(verifySharedSecret("s3cret", "s3cret")).toBe(true);
    expect(verifySharedSecret("s3cre", "s3cret")).toBe(false);
    expect(verifySharedSecret("S3cret", "s3cret")).toBe(false);
  });

  it("never matches when the expected secret is unset", () => {
    expect(verifySharedSecret("", undefined)).toBe(false);
    expect(verifySharedSecret(undefined, "")).toBe(false);
    expect(verifySharedSecret(null, undefined)).toBe(false);
  });
});

import { rateLimitBypassed } from "@/lib/security/rate-limit";

describe("rateLimitBypassed", () => {
  it("only bypasses outside production", () => {
    expect(rateLimitBypassed({ RATE_LIMIT_BYPASS: "1", NEXT_PUBLIC_APP_ENV: "local" })).toBe(true);
    expect(rateLimitBypassed({ RATE_LIMIT_BYPASS: "1", NEXT_PUBLIC_APP_ENV: "production" })).toBe(
      false,
    );
    expect(rateLimitBypassed({ NEXT_PUBLIC_APP_ENV: "local" })).toBe(false);
  });
});
