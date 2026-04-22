export interface BookmarkShape {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_username: string;
  created_at: string;
  category: string;
  media_urls: string;
  local_media?: string;
  bookmarked_at: string;
  raw_json?: string;
}

export interface RawTweetEntities {
  urls?: Array<{
    url?: string;
    expanded_url?: string;
    display_url?: string;
    title?: string;
    description?: string;
    unwound_url?: string;
    images?: Array<{ url: string; width: number; height: number }>;
  }>;
  hashtags?: Array<{ tag: string }>;
  mentions?: Array<{ username: string }>;
}

export interface RawTweetArticle {
  title?: string;
  preview_text?: string;
  plain_text?: string;
  media_entities?: string[];
  entities?: RawTweetEntities;
}

export interface ReferencedRawTweet {
  id?: string;
  text?: string;
  entities?: RawTweetEntities;
  note_tweet?: { text?: string; entities?: RawTweetEntities };
  article?: RawTweetArticle;
  author_id?: string;
  _author?: { name?: string; username?: string };
}

export interface RawTweet {
  id?: string;
  text?: string;
  entities?: RawTweetEntities;
  note_tweet?: { text?: string; entities?: RawTweetEntities };
  article?: RawTweetArticle;
  referenced_tweets?: Array<{ id?: string; type?: string }>;
  _referenced?: ReferencedRawTweet[];
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
}

export function parseRawTweet(rawJson?: string): RawTweet {
  if (!rawJson) return {};
  try {
    return JSON.parse(rawJson) as RawTweet;
  } catch {
    return {};
  }
}

export function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Resolve the best image URL to display for a bookmark image slot.
 * Prefers locally cached copy (served via /api/media/…) so the bookmark
 * still renders when the original tweet or CDN asset is removed.
 */
export function resolveImageSrc(originalUrl: string, localPath: string | undefined): string {
  if (localPath) return `/api/media/${localPath}`;
  return originalUrl;
}

/**
 * Get the best-effort full text for a bookmark. X returns truncated `text`
 * for long posts, but the complete copy lives in `note_tweet.text`.
 */
export function getFullText(bookmark: Pick<BookmarkShape, "text" | "raw_json">): string {
  const raw = parseRawTweet(bookmark.raw_json);
  return raw.note_tweet?.text || bookmark.text || "";
}

export interface ExternalLink {
  url: string;
  displayUrl: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  excerpt?: string;
  status?: string;
}

export interface LinkPreviewLike {
  final_url?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
  excerpt?: string | null;
  status?: string | null;
}

function isExcludedUrl(url: string): boolean {
  if (/^https?:\/\/(x|twitter)\.com\//i.test(url) && /\/status\//.test(url)) return true;
  if (/^https?:\/\/pic\.(x|twitter)\.com\//i.test(url)) return true;
  return false;
}

function shortDisplayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

/**
 * Extract outbound article/media links from the tweet entities so the
 * detail panel can show expanded previews without hitting t.co.
 * Falls back to text-extracted t.co links (with preview lookup) when
 * entities.urls is missing — common in older raw_json rows.
 */
export function extractExternalLinks(
  raw: RawTweet,
  previews: Record<string, LinkPreviewLike> = {},
  text?: string
): ExternalLink[] {
  const entities = raw.note_tweet?.entities || raw.entities;
  const urls = entities?.urls || [];
  const seen = new Set<string>();
  const entityShort = new Set<string>();
  const links: ExternalLink[] = [];

  for (const u of urls) {
    if (u.url) entityShort.add(u.url);
    const expanded = u.expanded_url || u.unwound_url;
    if (!expanded) continue;
    if (isExcludedUrl(expanded)) continue;
    if (seen.has(expanded)) continue;
    seen.add(expanded);
    const preview = previews[expanded];
    links.push({
      url: expanded,
      displayUrl: u.display_url || shortDisplayUrl(expanded),
      title: preview?.title || u.title,
      description: preview?.description || u.description,
      image: preview?.image || u.images?.[0]?.url,
      siteName: preview?.site_name || undefined,
      excerpt: preview?.excerpt || undefined,
      status: preview?.status || undefined,
    });
  }

  // Fallback: use t.co URLs from text when entities were not populated.
  const sources = [text, raw.text, raw.note_tweet?.text].filter(Boolean) as string[];
  for (const src of sources) {
    for (const tco of extractTcoFromText(src)) {
      if (entityShort.has(tco)) continue;
      const preview = previews[tco];
      if (!preview) continue;
      const target = preview.final_url || tco;
      if (isExcludedUrl(target)) continue;
      if (seen.has(target)) continue;
      seen.add(target);
      links.push({
        url: target,
        displayUrl: shortDisplayUrl(target),
        title: preview.title || undefined,
        description: preview.description || undefined,
        image: preview.image || undefined,
        siteName: preview.site_name || undefined,
        excerpt: preview.excerpt || undefined,
        status: preview.status || undefined,
      });
    }
  }

  return links;
}

const TCO_URL_RE = /https?:\/\/t\.co\/[A-Za-z0-9]+/g;

export function extractTcoFromText(text: string | undefined): string[] {
  if (!text) return [];
  const matches = text.match(TCO_URL_RE) || [];
  return [...new Set(matches)];
}

/**
 * Collect all external URLs that should be fetched for link preview.
 * Uses entities.urls when available, but also falls back to raw t.co links
 * embedded in the tweet text (older raw_json rows may not have entities).
 */
export function collectExternalUrls(raw: RawTweet, text?: string): string[] {
  const entities = raw.note_tweet?.entities || raw.entities;
  const urls = entities?.urls || [];
  const entityShortUrls = new Set<string>();
  const out: string[] = [];
  const seen = new Set<string>();

  for (const u of urls) {
    if (u.url) entityShortUrls.add(u.url);
    const expanded = u.expanded_url || u.unwound_url;
    if (!expanded) continue;
    if (isExcludedUrl(expanded)) continue;
    if (seen.has(expanded)) continue;
    seen.add(expanded);
    out.push(expanded);
  }

  const noteTweetText = raw.note_tweet?.text || "";
  const sources = [text, raw.text, noteTweetText].filter(Boolean) as string[];
  for (const src of sources) {
    for (const tco of extractTcoFromText(src)) {
      if (entityShortUrls.has(tco)) continue;
      if (seen.has(tco)) continue;
      seen.add(tco);
      out.push(tco);
    }
  }

  return out;
}

/**
 * Return a mapping t.co URL -> { expanded, display } used to replace short
 * links in rendered tweet text. Entities take priority; falls back to the
 * previews table when entities weren't populated in raw_json.
 */
export function buildShortLinkMap(
  raw: RawTweet,
  previews: Record<string, LinkPreviewLike> = {},
  text?: string
): Record<string, { expanded: string; display: string }> {
  const entities = raw.note_tweet?.entities || raw.entities;
  const urls = entities?.urls || [];
  const map: Record<string, { expanded: string; display: string }> = {};

  for (const u of urls) {
    if (!u.url) continue;
    const expanded = u.expanded_url || u.unwound_url || u.url;
    map[u.url] = {
      expanded,
      display: u.display_url || shortDisplayUrl(expanded),
    };
  }

  const sources = [text, raw.text, raw.note_tweet?.text].filter(Boolean) as string[];
  for (const src of sources) {
    for (const tco of extractTcoFromText(src)) {
      if (map[tco]) continue;
      const preview = previews[tco];
      if (!preview) continue;
      const expanded = preview.final_url || tco;
      map[tco] = {
        expanded,
        display: shortDisplayUrl(expanded),
      };
    }
  }

  return map;
}
