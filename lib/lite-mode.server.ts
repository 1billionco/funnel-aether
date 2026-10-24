import "server-only";

import { cookies, headers } from "next/headers";

import { decideLiteMode, LITE_COOKIE, LITE_COOKIE_OPTIONS } from "./lite-mode";

export async function isLiteMode(): Promise<boolean> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return decideLiteMode({ cookie: c.get(LITE_COOKIE)?.value, saveData: h.get("save-data") });
}

/** First-visit default from the org (e.g. NG orgs): only when the user hasn't chosen. */
export async function setLiteDefaultIfUnset(orgDefault: boolean) {
  const c = await cookies();
  if (c.get(LITE_COOKIE) === undefined && orgDefault) {
    c.set(LITE_COOKIE, "1", LITE_COOKIE_OPTIONS);
  }
}
