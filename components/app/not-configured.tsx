import { DatabaseZap } from "lucide-react";

import { StateBlock } from "@/components/ui/misc";

/** Shown instead of auth/app screens when no database is connected (mock mode). */
export function NotConfigured() {
  return (
    <StateBlock icon={<DatabaseZap />} title="No database connected yet">
      This server is running without Supabase keys, so accounts can&apos;t be created. Add{" "}
      <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
      <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to the environment
      (see docs/ENV.md).
    </StateBlock>
  );
}
