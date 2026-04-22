import type { LinkPreview } from "./db";

const FETCH_TIMEOUT_MS = 12000;
const MAX_BYTES = 1_500_000;
// Use a plain browser UA. Sites (notably t.co) return a different response
// to bot-ish UAs: t.co serves an HTML stub with a meta-refresh instead of a
// 301 redirect, which prevents us from following to the real destination.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const META_PROPERTY_RE = /<meta\s+[^>]*?(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/gi;
const META_CONTENT_FIRST_RE = /<meta\s+[^>]*?content\s*=\s*["']([^"']*)["'][^>]*?(?:property|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const SCRIPT_STYLE_RE = /<(script|style|noscript|template)[\s\S]*?<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function parseMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const set = (key: string, value: string) => {
    if (!meta[key] && value) meta[key] = decodeEntities(value).trim();
  };
  let m: RegExpExecArray | null;
  META_PROPERTY_RE.lastIndex = 0;
  while ((m = META_PROPERTY_RE.exec(html)) !== null) {
    set(m[1].toLowerCase(), m[2]);
  }
  META_CONTENT_FIRST_RE.lastIndex = 0;
  while ((m = META_CONTENT_FIRST_RE.exec(html)) !== null) {
    set(m[2].toLowerCase(), m[1]);
  }
  return meta;
}

function extractTitle(html: string): string | null {
  const m = html.match(TITLE_RE);
  if (!m) return null;
  return decodeEntities(m[1]).replace(WS_RE, " ").trim() || null;
}

function extractExcerpt(html: string, limit: number = 600): string | null {
  const stripped = html
    .replace(SCRIPT_STYLE_RE, " ")
    .replace(TAG_RE, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(WS_RE, " ")
    .trim();
  if (!stripped) return null;
  const decoded = decodeEntities(stripped);
  return decoded.length > limit ? decoded.slice(0, limit) + "…" : decoded;
}

function resolveUrl(base: string, maybeRelative: string | undefined | null): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

const SHORTENER_HOSTS = new Set([
  "t.co",
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "buff.ly",
  "ift.tt",
  "ow.ly",
  "lnkd.in",
  "dlvr.it",
]);

// Short-link services (notably t.co) respond differently to browser UAs —
// they return an HTML stub with meta-refresh JS instead of a 301. Resolve
// these by probing with an empty UA / manual redirect and reading Location.
async function resolveShortLink(startUrl: string): Promise<string> {
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    let host: string;
    try {
      host = new URL(current).host.toLowerCase();
    } catch {
      return current;
    }
    if (!SHORTENER_HOSTS.has(host)) return current;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "" },
      });
      clearTimeout(timer);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return current;
        current = new URL(loc, current).toString();
        continue;
      }
      return current;
    } catch {
      clearTimeout(timer);
      return current;
    }
  }
  return current;
}

async function fetchWithLimit(url: string): Promise<{ html: string; finalUrl: string; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      return { html: "", finalUrl: res.url, contentType };
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { html: text.slice(0, MAX_BYTES), finalUrl: res.url, contentType };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim() || "utf-8";
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = buf.toString("utf-8");
    }
    return { html, finalUrl: res.url, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function buildFailure(url: string, status: string): LinkPreview {
  return {
    url,
    final_url: null,
    title: null,
    description: null,
    image: null,
    site_name: null,
    excerpt: null,
    status,
    fetched_at: nowSeconds(),
  };
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return buildFailure(url, "invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return buildFailure(url, "bad_scheme");
  }

  const resolved = await resolveShortLink(parsed.toString());
  const result = await fetchWithLimit(resolved);
  if (!result) return buildFailure(url, "fetch_failed");

  const { html, finalUrl, contentType } = result;
  if (!html) {
    return {
      url,
      final_url: finalUrl,
      title: null,
      description: null,
      image: null,
      site_name: null,
      excerpt: null,
      status: `non_html:${contentType.split(";")[0]}`,
      fetched_at: nowSeconds(),
    };
  }

  const meta = parseMeta(html);
  const title =
    meta["og:title"] ||
    meta["twitter:title"] ||
    extractTitle(html) ||
    null;
  const description =
    meta["og:description"] ||
    meta["twitter:description"] ||
    meta["description"] ||
    null;
  const image = resolveUrl(finalUrl, meta["og:image"] || meta["twitter:image"] || null);
  const siteName = meta["og:site_name"] || meta["application-name"] || null;
  const excerpt = extractExcerpt(html);

  return {
    url,
    final_url: finalUrl,
    title,
    description,
    image,
    site_name: siteName,
    excerpt,
    status: "ok",
    fetched_at: nowSeconds(),
  };
}

export async function fetchManyLinkPreviews(
  urls: string[],
  concurrency: number = 4,
  onProgress?: (done: number, total: number) => void
): Promise<LinkPreview[]> {
  const results: LinkPreview[] = [];
  let index = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (true) {
      const i = index++;
      if (i >= urls.length) return;
      const preview = await fetchLinkPreview(urls[i]);
      results.push(preview);
      done++;
      onProgress?.(done, urls.length);
    }
  });
  await Promise.all(workers);
  return results;
}
