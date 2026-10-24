import type { ReactNode } from "react";
import { Hourglass } from "lucide-react";

import { StateBlock } from "@/components/ui/misc";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

/** Honest placeholder for screens that arrive in a later milestone. */
export function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <StateBlock icon={<Hourglass />} title="Coming soon">
        {children}
      </StateBlock>
    </>
  );
}
