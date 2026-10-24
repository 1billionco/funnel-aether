import { redirect } from "next/navigation";

import { homePathFor, requireUser } from "@/lib/auth/session";

/** Fallback landing for already-signed-in visitors of /sign-in and /sign-up. */
export default async function ContinuePage() {
  await requireUser();
  redirect(await homePathFor());
}
