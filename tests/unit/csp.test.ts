import { describe, expect, it } from "vitest";

import { buildCsp } from "@/lib/security/csp";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("buildCsp", () => {
  it("forbids framing for app pages and allows it for embeddable forms", () => {
    expect(
      directive(buildCsp({ frameAncestors: "'none'", isDev: false, env: {} }), "frame-ancestors"),
    ).toBe("'none'");
    expect(
      directive(buildCsp({ frameAncestors: "*", isDev: false, env: {} }), "frame-ancestors"),
    ).toBe("*");
  });

  it("only allows unsafe-eval in development", () => {
    expect(buildCsp({ frameAncestors: "'none'", isDev: false, env: {} })).not.toContain(
      "unsafe-eval",
    );
    expect(buildCsp({ frameAncestors: "'none'", isDev: true, env: {} })).toContain("unsafe-eval");
  });

  it("adds Supabase REST and Realtime origins to connect-src", () => {
    const csp = buildCsp({
      frameAncestors: "'none'",
      isDev: false,
      env: { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" },
    });
    const connect = directive(csp, "connect-src");
    expect(connect).toContain("https://abc.supabase.co");
    expect(connect).toContain("wss://abc.supabase.co");
  });

  it("only adds PostHog when a key is configured", () => {
    const host = "https://eu.i.posthog.com";
    expect(
      buildCsp({ frameAncestors: "'none'", isDev: false, env: { NEXT_PUBLIC_POSTHOG_HOST: host } }),
    ).not.toContain("posthog");
    const csp = buildCsp({
      frameAncestors: "'none'",
      isDev: false,
      env: { NEXT_PUBLIC_POSTHOG_HOST: host, NEXT_PUBLIC_POSTHOG_KEY: "phc_x" },
    });
    expect(directive(csp, "connect-src")).toContain("https://eu-assets.i.posthog.com");
  });
});
