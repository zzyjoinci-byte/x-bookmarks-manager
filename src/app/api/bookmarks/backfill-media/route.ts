import { NextResponse } from "next/server";
import {
  getAllBookmarksForMedia,
  updateBookmarkLocalMedia,
} from "@/lib/db";
import { downloadAllMedia } from "@/lib/media";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/bookmarks/backfill-media
// Re-download media for any bookmark whose local_media is empty or incomplete.
// No X API calls — uses URLs already saved in media_urls.
export async function POST() {
  const rows = getAllBookmarksForMedia();
  let scanned = 0;
  let downloaded = 0;
  let bookmarksUpdated = 0;
  const failures: string[] = [];

  for (const row of rows) {
    scanned++;
    let mediaUrls: string[] = [];
    let existingLocal: string[] = [];
    try {
      mediaUrls = JSON.parse(row.media_urls || "[]");
    } catch {
      mediaUrls = [];
    }
    try {
      existingLocal = JSON.parse(row.local_media || "[]");
    } catch {
      existingLocal = [];
    }
    if (mediaUrls.length === 0) continue;
    if (existingLocal.length >= mediaUrls.length) continue;

    const local = await downloadAllMedia(row.id, mediaUrls);
    if (local.length === 0) {
      failures.push(row.id);
      continue;
    }
    updateBookmarkLocalMedia(row.id, JSON.stringify(local));
    bookmarksUpdated++;
    downloaded += local.length;
  }

  return NextResponse.json({
    scanned,
    bookmarksUpdated,
    downloaded,
    failed: failures.length,
  });
}
