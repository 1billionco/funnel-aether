"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Globe, Type } from "lucide-react";

import {
  addPastedText,
  finalizeUpload,
  importFromUrl,
  requestUpload,
} from "@/app/(app)/[org]/_actions/brand-docs";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Checkbox,
  Label,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { DOC_TYPE_LABELS, DOC_TYPES, type DocType } from "@/lib/brand-voice/quality";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

const ACCEPT =
  ".pdf,.docx,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv";
const typeOptions = DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] }));

function Status({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={
        ok
          ? "text-sm text-approve-fg"
          : "rounded-input bg-danger/10 px-3 py-2 text-sm text-danger-fg"
      }
    >
      {message}
    </p>
  );
}

export function SampleUploader({
  slug,
  brandId,
  defaultTab = "upload",
}: {
  slug: string;
  brandId: string;
  defaultTab?: "upload" | "paste" | "url";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ message?: string; ok?: boolean }>({});

  // Upload
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadType, setUploadType] = React.useState<DocType>("past_content");
  const [keep, setKeep] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  // Paste
  const [pasteType, setPasteType] = React.useState<DocType>("tone_examples");

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    setResult({});
    try {
      const r = await fn();
      setResult({
        ok: r.ok,
        message: r.message ?? (r.ok ? "Added. We're reading it now." : undefined),
      });
      if (r.ok) router.refresh();
      return r.ok;
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function upload() {
    if (!file) return setResult({ ok: false, message: "Choose a file first." });
    const ok = await run(async () => {
      const start = await requestUpload(slug, {
        brandId,
        filename: file.name,
        mime: file.type,
        size: file.size,
        docType: uploadType,
        keepOriginal: keep,
      });
      if (!start.ok || !start.data) return start;
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return { ok: false, message: "Uploads aren't available on this server." };
      const { error } = await supabase.storage
        .from("brand-docs")
        .uploadToSignedUrl(start.data.path, start.data.token, file, {
          contentType: file.type || undefined,
        });
      if (error)
        return { ok: false, message: "The upload failed. Check your connection and try again." };
      return finalizeUpload(slug, start.data.documentId);
    });
    if (ok) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full">
        <TabsTrigger value="upload">
          <FileUp className="mr-1.5 inline size-4" />
          Upload
        </TabsTrigger>
        <TabsTrigger value="paste">
          <Type className="mr-1.5 inline size-4" />
          Paste
        </TabsTrigger>
        <TabsTrigger value="url">
          <Globe className="mr-1.5 inline size-4" />
          Website
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-file">File</Label>
          <input
            ref={fileInput}
            id="sample-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-input border border-dashed border-line bg-surface p-3 text-sm file:mr-3 file:rounded-input file:border-0 file:bg-primary-tint file:px-3 file:py-2 file:text-primary-fg"
            aria-describedby="sample-file-hint"
          />
          <p id="sample-file-hint" className="text-sm text-muted">
            PDF, Word, text, Markdown or CSV, up to 10 MB.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="upload-type">What is it?</Label>
          <Select
            id="upload-type"
            value={uploadType}
            onValueChange={(v) => setUploadType(v as DocType)}
            options={typeOptions}
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} />
          Keep the original file (otherwise we delete it once we&apos;ve read it)
        </label>
        <Status {...result} />
        <Button onClick={upload} disabled={pending || !file} className="self-start">
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </TabsContent>

      <TabsContent value="paste">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const ok = await run(() =>
              addPastedText(slug, {
                brandId,
                title: String(fd.get("title") ?? ""),
                text: String(fd.get("text") ?? ""),
                docType: pasteType,
              }),
            );
            if (ok) form.reset();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paste-text">Paste a few past posts, emails or messages</Label>
            <Textarea id="paste-text" name="text" className="min-h-40" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paste-title">Name (optional)</Label>
              <Input id="paste-title" name="title" placeholder="e.g. Last month's posts" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paste-type">What is it?</Label>
              <Select
                id="paste-type"
                value={pasteType}
                onValueChange={(v) => setPasteType(v as DocType)}
                options={typeOptions}
              />
            </div>
          </div>
          <Status {...result} />
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Adding…" : "Add text"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="url">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await run(() => importFromUrl(slug, { brandId, url: String(fd.get("url") ?? "") }));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-url">Web page</Label>
            <Input
              id="import-url"
              name="url"
              inputMode="url"
              placeholder="yourbusiness.com/about"
              required
              aria-describedby="import-url-hint"
            />
            <p id="import-url-hint" className="text-sm text-muted">
              We read the text on that one page. Your About or Services page works best.
            </p>
          </div>
          <Status {...result} />
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Reading the page…" : "Import"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
