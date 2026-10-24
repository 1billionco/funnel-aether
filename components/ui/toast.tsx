"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  tone?: "neutral" | "approve" | "danger";
  action?: { label: string; onClick: () => void };
}

const ToastContext = React.createContext<{ show: (t: Omit<Toast, "id">) => void }>({
  show: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const dismiss = React.useCallback(
    (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)),
    [],
  );
  const show = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.action ? 8000 : 4000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border px-4 py-3 text-sm shadow-soft",
              t.tone === "danger"
                ? "border-danger/30 bg-surface text-danger-fg"
                : "border-line bg-ink text-paper",
            )}
          >
            <span className="flex-1">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="min-h-11 rounded-input px-2 font-medium underline underline-offset-4"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              className="grid size-8 place-items-center rounded-input opacity-70 hover:opacity-100"
              onClick={() => dismiss(t.id)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
