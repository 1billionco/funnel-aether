"use client";

import { useActionState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { submitFeedback, type FeedbackState } from "@/app/(app)/[org]/_actions/account";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Label } from "@/components/ui/primitives";

export function FeedbackButton({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(
    submitFeedback.bind(null, slug),
    {},
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Send feedback">
          <MessageSquarePlus />
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Send feedback"
        description="Ideas, bugs, anything confusing. It goes straight to the founder."
      >
        {state.ok ? (
          <p role="status" className="text-approve-fg">
            {state.message}
          </p>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Type</legend>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  value="idea"
                  defaultChecked
                  className="accent-[var(--primary)]"
                />{" "}
                Idea
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="kind" value="bug" className="accent-[var(--primary)]" />{" "}
                Something&apos;s broken
              </label>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="feedback-text">Your message</Label>
              <Textarea id="feedback-text" name="text" required />
            </div>
            {state.message ? (
              <p role="alert" className="text-sm text-danger-fg">
                {state.message}
              </p>
            ) : null}
            <Button type="submit" disabled={pending} className="self-end">
              {pending ? "Sending…" : "Send"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
