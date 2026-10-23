import { describe, expect, it } from "vitest";

import { withDb } from "./helpers";

describe("database foundations", () => {
  it("has pgvector installed for brand retrieval", async () => {
    const rows = await withDb(
      async (db) =>
        (
          await db.query(
            "select extname from pg_extension where extname in ('vector','pgcrypto') order by 1",
          )
        ).rows,
    );
    expect(rows.map((r) => r.extname)).toEqual(["pgcrypto", "vector"]);
  });

  it("supports 1024-dimension cosine distance", async () => {
    const d = await withDb(async (db) => {
      const v = `[${Array(1024).fill(0.1).join(",")}]`;
      const r = await db.query("select ($1::extensions.vector <=> $1::extensions.vector) as d", [
        v,
      ]);
      return Number(r.rows[0].d);
    });
    expect(d).toBeCloseTo(0, 6);
  });
});
