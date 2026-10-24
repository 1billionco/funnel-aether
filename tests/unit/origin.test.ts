import { describe, expect, it } from "vitest";

import { requestOrigin } from "@/lib/auth/origin";

describe("requestOrigin", () => {
  it("prefers the forwarded public host over the internal one", () => {
    const h = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "funnelaether.netlify.app",
      "x-forwarded-proto": "https",
    });
    expect(requestOrigin(h)).toBe("https://funnelaether.netlify.app");
  });

  it("uses http for local hosts and https otherwise", () => {
    expect(requestOrigin(new Headers({ host: "127.0.0.1:3100" }))).toBe("http://127.0.0.1:3100");
    expect(requestOrigin(new Headers({ host: "example.com" }))).toBe("https://example.com");
  });

  it("takes the first value of a forwarded list", () => {
    const h = new Headers({ "x-forwarded-host": "a.example, b.example" });
    expect(requestOrigin(h)).toBe("https://a.example");
  });
});
