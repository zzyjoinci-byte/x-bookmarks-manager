import { NextResponse } from "next/server";
import { getAllBookmarksForClassify, batchUpdateCategories, getBookmarks, getBookmarkCount } from "@/lib/db";
import { classifyMany } from "@/lib/classifier";

// POST /api/classify — re-classify all bookmarks
export async function POST() {
  const items = getAllBookmarksForClassify();
  const updates = classifyMany(items);
  batchUpdateCategories(updates);
  const bookmarks = getBookmarks();
  const counts = getBookmarkCount();
  return NextResponse.json({ bookmarks, counts, reclassified: updates.length });
}
