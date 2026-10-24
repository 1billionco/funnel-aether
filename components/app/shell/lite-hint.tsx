"use client";

import * as React from "react";
import { Gauge, X } from "lucide-react";

import { setLiteMode } from "@/app/(app)/[org]/_actions/account";
import { Button } from "@/components/ui/button";

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

function slowConnection(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (!c) return false; // Safari/Firefox: no hint available.
  return !!c.saveData || ["slow-2g", "2g", "3g"].includes(c.effectiveType ?? "");
}

/**
 * navigator.connection is only a client-side hint (spec §7.3). We suggest Lite
 * mode; the server decides from the cookie this sets.
 */
export function LiteHint() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("fa-lite-hint") === "dismissed";
    } catch {}
    if (!dismissed && slowConnection()) {
      const t = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(t);
    }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem("fa-lite-hint", "dismissed");
    } catch {}
    setShow(false);
  };
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-line bg-primary-tint px-4 py-2 text-sm"
    >
      <Gauge className="size-4 shrink-0 text-primary-fg" aria-hidden />
      <span className="flex-1">
        Your connection looks slow. Lite mode loads faster and uses less data.
      </span>
      <Button size="sm" variant="subtle" onClick={() => setLiteMode(true)}>
        Switch on
      </Button>
      <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}
