"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  Progress,
  Select,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/components/ui/primitives";

export function InteractiveShowcase() {
  const [tone, setTone] = React.useState([40]);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Formal</span>
            <span className="text-muted">Casual</span>
          </div>
          <Slider
            value={tone}
            onValueChange={setTone}
            max={100}
            step={1}
            aria-label="Formal to casual"
          />
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <Checkbox id="dev-consent" />
          <span className="text-sm">I agree to receive marketing emails (unticked by default)</span>
        </label>
        <div className="flex min-h-11 items-center justify-between">
          <Label htmlFor="dev-lite">Lite mode</Label>
          <Switch id="dev-lite" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dev-market">Market</Label>
          <Select
            id="dev-market"
            placeholder="Choose your market"
            options={[
              { value: "UK", label: "United Kingdom (GBP)" },
              { value: "NG", label: "Nigeria (NGN)" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Onboarding progress</span>
          <Progress value={60} aria-label="Onboarding progress" />
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
        <Tabs defaultValue="post">
          <TabsList>
            <TabsTrigger value="post">Post</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>
          <TabsContent value="post" className="text-sm text-muted">
            LinkedIn post preview lives here.
          </TabsContent>
          <TabsContent value="email" className="text-sm text-muted">
            Email preview with subject and preheader.
          </TabsContent>
          <TabsContent value="whatsapp" className="text-sm text-muted">
            WhatsApp bubble preview.
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Reject draft</Button>
            </DialogTrigger>
            <DialogContent
              title="Reject this draft?"
              description="Optional: tell the AI why, so the next draft is better."
            >
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger">Reject</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Schedule</DropdownMenuItem>
              <DropdownMenuItem className="text-danger-fg">Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip content="Similar to your past posts; includes a clear call to action.">
            <Button variant="subtle" size="sm">
              Why 82?
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
