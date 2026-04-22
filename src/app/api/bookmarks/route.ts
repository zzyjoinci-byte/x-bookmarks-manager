import { NextRequest, NextResponse } from "next/server";
import { fetchBookmarks } from "@/lib/twitter";
import {
  upsertBookmark,
  getBookmarks,
  updateBookmarkCategory,
  getBookmarkCount,
  getExistingIds,
  getAllCategoryNames,
  getLinkPreviews,
  type Bookmark,
} from "@/lib/db";
import { classify } from "@/lib/classifier";
import { getValidAccessToken } from "@/lib/oauth";
import { parseRawTweet, collectExternalUrls } from "@/lib/bookmark-shape";

function collectPreviewsFor(bookmarks: Bookmark[]) {
  const urls = new Set<string>();
  for (const bm of bookmarks) {
    const raw = parseRawTweet(bm.raw_json);
    for (const url of collectExternalUrls(raw, bm.text)) {
      urls.add(url);
    }
  }
  return getLinkPreviews([...urls]);
}

// GET /api/bookmarks?category=xxx
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const bookmarks = getBookmarks(category);
  const counts = getBookmarkCount();
  const allCategories = getAllCategoryNames();
  const linkPreviews = collectPreviewsFor(bookmarks);
  return NextResponse.json({ bookmarks, counts, allCategories, linkPreviews });
}

// POST /api/bookmarks — sync from X API using OAuth 2.0 token
export async function POST() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated. Please authorize with X first." }, { status: 401 });
  }

  try {
    const existingIds = getExistingIds();
    const result = await fetchBookmarks(token, existingIds);

    for (const bm of result.bookmarks) {
      const category = classify(bm);
      upsertBookmark({ ...bm, category });
    }

    const bookmarks = getBookmarks();
    const counts = getBookmarkCount();
    const allCategories = getAllCategoryNames();
    const linkPreviews = collectPreviewsFor(bookmarks);
    return NextResponse.json({
      bookmarks,
      counts,
      allCategories,
      linkPreviews,
      synced: result.bookmarks.length,
      apiCalls: result.apiCalls,
      stoppedEarly: result.stoppedEarly,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/bookmarks — update category for one bookmark
export async function PATCH(req: NextRequest) {
  const { id, category } = await req.json();
  if (!id || !category) {
    return NextResponse.json({ error: "id and category are required" }, { status: 400 });
  }
  updateBookmarkCategory(id, category);
  return NextResponse.json({ ok: true });
}
