import { describe, expect, it } from "vitest";

import { extractText, htmlToText, normaliseMime } from "@/lib/brand-voice/extract";
import { isPrivateAddress, safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";

describe("htmlToText", () => {
  it("drops scripts, styles and navigation, keeps readable text", () => {
    const html = `<html><head><style>p{}</style><script>alert(1)</script></head><body>
      <nav>Home | About</nav><h1>Hartley &amp; Co.</h1><p>We make tax&nbsp;simple.</p>
      <ul><li>Bookkeeping</li><li>Payroll</li></ul><footer>© 2026</footer></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Hartley & Co.");
    expect(text).toContain("We make tax simple.");
    expect(text).toContain("- Bookkeeping");
    expect(text).not.toMatch(/alert|Home \| About|©/);
  });
});

describe("extractText", () => {
  it("decodes plain text and strips NULs", async () => {
    expect(await extractText(new TextEncoder().encode("Hi\u0000 there"), "text/plain")).toBe(
      "Hi there",
    );
  });
});

describe("normaliseMime", () => {
  it("infers from extension when the browser sends nothing", () => {
    expect(normaliseMime("", "notes.md")).toBe("text/markdown");
    expect(normaliseMime("application/octet-stream", "guide.docx")).toContain("wordprocessingml");
    expect(normaliseMime("text/plain; charset=utf-8", "a.txt")).toBe("text/plain");
  });
});

describe("SSRF protection", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );

  it.each([
    "http://127.0.0.1/",
    "http://localhost:3000/",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "http://[::1]/",
    "http://user:pw@example.com/",
    "http://example.com:8080/",
  ])("refuses %s before connecting", async (url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
