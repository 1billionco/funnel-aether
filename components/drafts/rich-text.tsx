import * as React from "react";

/**
 * Renders draft text with a tiny, safe subset of formatting: ## headings,
 * "- " bullets, **bold** / *bold* (WhatsApp), _italic_. No HTML is ever
 * interpreted; React escapes everything.
 */
function inline(text: string, key: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*"))
      parts.push(<strong key={`${key}-${i++}`}>{tok.slice(1, -1)}</strong>);
    else parts.push(<em key={`${key}-${i++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={bi} className="my-2 list-disc pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-•]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        const heading = lines[0]!.match(/^(#{2,3})\s+(.*)$/);
        if (heading) {
          return (
            <React.Fragment key={bi}>
              <p
                className={
                  heading[1] === "##" ? "mt-3 text-lg font-semibold" : "mt-2 font-semibold"
                }
              >
                {inline(heading[2]!, `${bi}-h`)}
              </p>
              {lines.length > 1 ? <RichText text={lines.slice(1).join("\n")} /> : null}
            </React.Fragment>
          );
        }
        return (
          <p key={bi} className="my-2 whitespace-pre-line first:mt-0">
            {inline(block, `${bi}`)}
          </p>
        );
      })}
    </div>
  );
}
