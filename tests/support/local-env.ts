import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/**
 * Local Supabase credentials for tests: .env.local if present, otherwise
 * `supabase status -o env`. Refuses non-local hosts (never test against prod)
 * unless ALLOW_REMOTE_TEST_DB=1 for a dedicated test project.
 */
export function localSupabaseEnv() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if ((!url || !anon || !service) && existsSync(".env.local")) {
    const vars = Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    );
    url ??= vars.NEXT_PUBLIC_SUPABASE_URL;
    anon ??= vars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    service ??= vars.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!url || !anon || !service) {
    const out = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
    const vars = Object.fromEntries(
      out
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [
          l.slice(0, l.indexOf("=")),
          l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, ""),
        ]),
    );
    url = vars.API_URL;
    anon = vars.ANON_KEY;
    service = vars.SERVICE_ROLE_KEY;
  }
  const host = new URL(url!).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(`Refusing to run tests against non-local Supabase host ${host}`);
  }
  return { url: url!, anon: anon!, service: service! };
}
