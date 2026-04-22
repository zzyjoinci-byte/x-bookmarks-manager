import { NextResponse } from "next/server";
import {
  getAllBookmarksForClassify,
  batchUpdateCategories,
  getBookmarks,
  getBookmarkCount,
  getLinkPreviews,
} from "@/lib/db";
import { classifyMany } from "@/lib/classifier";
import { parseRawTweet, collectExternalUrls } from "@/lib/bookmark-shape";

// POST /api/classify — re-classify all bookmarks
export async function POST() {
  const items = getAllBookmarksForClassify();
  const updates = classifyMany(items);
  batchUpdateCategories(updates);
  const bookmarks = getBookmarks();
  const counts = getBookmarkCount();
  const urls = new Set<string>();
  for (const bm of bookmarks) {
    for (const u of collectExternalUrls(parseRawTweet(bm.raw_json), bm.text)) urls.add(u);
  }
  const linkPreviews = getLinkPreviews([...urls]);
  return NextResponse.json({ bookmarks, counts, linkPreviews, reclassified: updates.length });
}
