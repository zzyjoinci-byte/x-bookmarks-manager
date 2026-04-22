import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const MEDIA_ROOT = path.join(process.cwd(), "data", "media");

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|mp4)(?:$|[?#])/i);
    if (match) return match[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return "jpg";
}

function hashUrl(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Download one media URL into data/media/<bookmarkId>/.
 * Returns a relative path under MEDIA_ROOT (e.g. "<bookmarkId>/<hash>.jpg"),
 * or null on failure. Skips download if the file already exists.
 */
export async function downloadMedia(bookmarkId: string, url: string): Promise<string | null> {
  if (!url) return null;
  const safeId = bookmarkId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;

  const dir = path.join(MEDIA_ROOT, safeId);
  const filename = `${hashUrl(url)}.${extFromUrl(url)}`;
  const absPath = path.join(dir, filename);
  const relPath = `${safeId}/${filename}`;

  try {
    await fs.access(absPath);
    return relPath;
  } catch {
    /* not cached — continue */
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await ensureDir(dir);
    await fs.writeFile(absPath, buf);
    return relPath;
  } catch {
    return null;
  }
}

export async function downloadAllMedia(bookmarkId: string, urls: string[]): Promise<string[]> {
  const results = await Promise.all(urls.map((u) => downloadMedia(bookmarkId, u)));
  return results.filter((r): r is string => !!r);
}

/**
 * Resolve a relative media path (from local_media) to an absolute path,
 * guarding against traversal outside MEDIA_ROOT.
 */
export function resolveMediaPath(relative: string): string | null {
  const abs = path.resolve(MEDIA_ROOT, relative);
  const rootWithSep = MEDIA_ROOT.endsWith(path.sep) ? MEDIA_ROOT : MEDIA_ROOT + path.sep;
  if (!abs.startsWith(rootWithSep)) return null;
  return abs;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
};

export function mimeFor(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}
