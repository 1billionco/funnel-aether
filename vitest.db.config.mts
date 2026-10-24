import { defineConfig } from "vitest/config";

/**
 * Integration tests against a real Postgres (Supabase CLI local stack).
 * Never point these at production — see tests/db/helpers.ts guard.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
