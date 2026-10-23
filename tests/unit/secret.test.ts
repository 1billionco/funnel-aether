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
