import { Client } from "pg";

/**
 * Connection for DB integration tests. Defaults to the Supabase CLI local
 * stack. Refuses anything that isn't local unless ALLOW_REMOTE_TEST_DB=1 is
 * set explicitly for a dedicated *test* project — never production.
 */
export function testDbUrl(): string {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const host = new URL(url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(`Refusing to run DB tests against non-local host ${host}`);
  }
  return url;
}

export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: testDbUrl() });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}
