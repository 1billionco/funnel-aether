import type { ServiceSupabase } from "./service";
import type { Database } from "./types";

type PublicTables = Database["public"]["Tables"];

/** Tables whose rows carry an org_id column. */
export type TenantTable = {
  [K in keyof PublicTables]: PublicTables[K]["Row"] extends { org_id: string } ? K : never;
}[keyof PublicTables];

type Insert<T extends TenantTable> = Omit<PublicTables[T]["Insert"], "org_id">;
type Update<T extends TenantTable> = Omit<PublicTables[T]["Update"], "org_id">;

/**
 * Org-scoped wrapper over the service-role client (spec §9). The service role
 * bypasses RLS, so every read/update/delete is filtered by org_id and every
 * insert has org_id forced. Use this instead of calling db.from() directly
 * in background jobs and webhooks.
 */
export function withOrg(db: ServiceSupabase, orgId: string) {
  if (!orgId) throw new Error("withOrg: orgId is required");
  return {
    orgId,
    select<T extends TenantTable>(table: T, columns = "*") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (db.from(table) as any).select(columns).eq("org_id", orgId);
    },
    insert<T extends TenantTable>(table: T, rows: Insert<T> | Insert<T>[]) {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, org_id: orgId }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (db.from(table) as any).insert(list);
    },
    update<T extends TenantTable>(table: T, values: Update<T>) {
      const { org_id: _ignored, ...safe } = values as Update<T> & { org_id?: unknown };
      void _ignored;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (db.from(table) as any).update(safe).eq("org_id", orgId);
    },
    delete<T extends TenantTable>(table: T) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (db.from(table) as any).delete().eq("org_id", orgId);
    },
  };
}
