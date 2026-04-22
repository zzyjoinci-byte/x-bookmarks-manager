import { NextResponse } from "next/server";
import { getAllBookmarksForClassify, hasLinkPreview, upsertLinkPreview } from "@/lib/db";
import { parseRawTweet, collectExternalUrls } from "@/lib/bookmark-shape";
import { fetchManyLinkPreviews } from "@/lib/link-preview";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/links/backfill
// Walks every bookmark, collects unique external URLs, and fetches OG metadata
// for any URL that hasn't been cached yet.
export async function POST() {
  const bookmarks = getAllBookmarksForClassify();
  const allUrls = new Set<string>();
  for (const bm of bookmarks) {
    const raw = parseRawTweet(bm.raw_json);
    for (const url of collectExternalUrls(raw, bm.text)) {
      allUrls.add(url);
    }
  }

  const pending = [...allUrls].filter((url) => !hasLinkPreview(url));
  let okCount = 0;
  let failCount = 0;

  const previews = await fetchManyLinkPreviews(pending, 4);
  for (const preview of previews) {
    upsertLinkPreview(preview);
    if (preview.status === "ok") okCount++;
    else failCount++;
  }

  return NextResponse.json({
    totalUrls: allUrls.size,
    pending: pending.length,
    fetched: previews.length,
    ok: okCount,
    failed: failCount,
  });
}
