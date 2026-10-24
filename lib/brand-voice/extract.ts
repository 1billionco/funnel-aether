/** Text extraction for brand documents (spec §9: PDF, DOCX, TXT, MD, CSV; page/char cap). */
export const MAX_CHARS = 200_000;
export const MAX_PDF_PAGES = 60;

export const ALLOWED_MIME = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "text/plain": "Text",
  "text/markdown": "Markdown",
  "text/csv": "CSV",
} as const;
export type AllowedMime = keyof typeof ALLOWED_MIME;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function isAllowedMime(mime: string): mime is AllowedMime {
  return mime in ALLOWED_MIME;
}

/** Browsers often send "" for .md; infer from the extension as a fallback. */
export function normaliseMime(mime: string, filename: string): string {
  if (mime && mime !== "application/octet-stream") return mime.split(";")[0]!.trim().toLowerCase();
  const ext = filename.toLowerCase().split(".").pop();
  return (
    (
      {
        pdf: "application/pdf",
        docx: ALLOWED_MIME_BY_EXT.docx,
        txt: "text/plain",
        md: "text/markdown",
        markdown: "text/markdown",
        csv: "text/csv",
      } as Record<string, string>
    )[ext ?? ""] ?? mime
  );
}
const ALLOWED_MIME_BY_EXT = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  pound: "£",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code =
          e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractText(data: Uint8Array, mime: string): Promise<string> {
  let text: string;
  switch (mime) {
    case "application/pdf": {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(data);
      const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
      const parts: string[] = [];
      for (let i = 1; i <= pages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
      }
      text = parts.join("\n\n");
      break;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
      text = result.value;
      break;
    }
    case "text/html":
      text = htmlToText(new TextDecoder().decode(data));
      break;
    default:
      text = new TextDecoder().decode(data);
  }
  return text.replace(/\u0000/g, "").slice(0, MAX_CHARS);
}
