/**
 * Recursive character splitter, ported from the original backend
 * (LangChain RecursiveCharacterTextSplitter: chunk_size=800, chunk_overlap=150,
 * separators ["\n\n", "\n", ". ", " ", ""], separators kept with the next piece).
 */
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 150;
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

function splitKeepingSeparator(text: string, separator: string): string[] {
  if (separator === "") return Array.from(text);
  const parts = text.split(separator);
  return parts.map((p, i) => (i === 0 ? p : separator + p)).filter((p) => p !== "");
}

function mergeSplits(splits: string[], size: number, overlap: number): string[] {
  const docs: string[] = [];
  let current: string[] = [];
  let total = 0;
  for (const piece of splits) {
    if (total + piece.length > size && current.length > 0) {
      const doc = current.join("").trim();
      if (doc) docs.push(doc);
      // Drop from the front until we're within the overlap budget and the next piece fits.
      while (total > overlap || (total + piece.length > size && total > 0)) {
        total -= current[0]!.length;
        current = current.slice(1);
      }
    }
    current.push(piece);
    total += piece.length;
  }
  const doc = current.join("").trim();
  if (doc) docs.push(doc);
  return docs;
}

function splitRecursive(
  text: string,
  separators: string[],
  size: number,
  overlap: number,
): string[] {
  let separator = separators[separators.length - 1]!;
  let rest: string[] = [];
  for (let i = 0; i < separators.length; i++) {
    const s = separators[i]!;
    if (s === "") {
      separator = s;
      break;
    }
    if (text.includes(s)) {
      separator = s;
      rest = separators.slice(i + 1);
      break;
    }
  }

  const out: string[] = [];
  let good: string[] = [];
  for (const piece of splitKeepingSeparator(text, separator)) {
    if (piece.length < size) {
      good.push(piece);
      continue;
    }
    if (good.length) {
      out.push(...mergeSplits(good, size, overlap));
      good = [];
    }
    if (rest.length === 0) out.push(piece.trim());
    else out.push(...splitRecursive(piece, rest, size, overlap));
  }
  if (good.length) out.push(...mergeSplits(good, size, overlap));
  return out.filter(Boolean);
}

/** Normalises whitespace and splits into overlapping chunks. */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const normalised = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalised) return [];
  return splitRecursive(normalised, SEPARATORS, size, overlap);
}

/** Rough token estimate (~4 characters per token for English). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
