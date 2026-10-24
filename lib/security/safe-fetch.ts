import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { Agent, fetch as undiciFetch } from "undici";

/**
 * Server-side URL fetch with SSRF protection (spec §9): http(s) only,
 * public IPs only (checked when resolving AND at connect time, which defeats
 * DNS rebinding), manual redirects re-validated, size and time limits.
 */
export const FETCH_LIMITS = { timeoutMs: 8_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 3 };

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return (
      /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8")
    );
  }
  return true; // not an IP at all: refuse
}

export class UnsafeUrlError extends Error {}

async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("That address isn't allowed.");
    return;
  }
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host))
    throw new UnsafeUrlError("That address isn't allowed.");
  const addrs = await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address)))
    throw new UnsafeUrlError("That address isn't allowed.");
}

// Every connection re-checks the resolved address (closes the DNS-rebinding gap).
const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true, verbatim: true })
        .then((addrs) => {
          const bad = addrs.find((a) => isPrivateAddress(a.address));
          if (bad || !addrs.length)
            return callback(new UnsafeUrlError("That address isn't allowed."), "", 4);
          if ((options as { all?: boolean }).all)
            return (callback as unknown as (e: null, a: typeof addrs) => void)(null, addrs);
          callback(null, addrs[0]!.address, addrs[0]!.family);
        })
        .catch((e: Error) => callback(e, "", 4));
    },
  },
});

export interface SafeFetchResult {
  url: string;
  contentType: string;
  body: Uint8Array;
}

export async function safeFetch(
  rawUrl: string,
  accept = /^(text\/html|text\/plain|application\/xhtml\+xml)/,
): Promise<SafeFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Enter a full web address, like https://yourbusiness.com.");
  }
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new UnsafeUrlError("Only http and https addresses are allowed.");
    if (url.username || url.password) throw new UnsafeUrlError("That address isn't allowed.");
    if (url.port && !["80", "443"].includes(url.port))
      throw new UnsafeUrlError("That address isn't allowed.");
    await assertPublicHost(url.hostname);

    const res = await undiciFetch(url, {
      redirect: "manual",
      dispatcher: guardedAgent,
      signal: AbortSignal.timeout(FETCH_LIMITS.timeoutMs),
      headers: {
        "user-agent": "FunnelAetherBot/1.0 (+brand voice import)",
        accept: "text/html,text/plain;q=0.9",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The page returned an error (${res.status}).`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!accept.test(contentType))
      throw new UnsafeUrlError("That page isn't a web page we can read.");
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > FETCH_LIMITS.maxBytes) throw new UnsafeUrlError("That page is too large.");

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > FETCH_LIMITS.maxBytes) {
        await reader.cancel();
        throw new UnsafeUrlError("That page is too large.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.byteLength;
    }
    return { url: url.toString(), contentType, body };
  }
  throw new UnsafeUrlError("Too many redirects.");
}
