import { NextRequest, NextResponse } from "next/server";
import { fetchBookmarks } from "@/lib/twitter";
import { upsertBookmark, getBookmarks, updateBookmarkCategory, getBookmarkCount, getExistingIds, getAllCategoryNames } from "@/lib/db";
import { classify } from "@/lib/classifier";
import { getStoredToken } from "@/lib/oauth";

// GET /api/bookmarks?category=xxx
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const bookmarks = getBookmarks(category);
  const counts = getBookmarkCount();
  const allCategories = getAllCategoryNames();
  return NextResponse.json({ bookmarks, counts, allCategories });
}

// POST /api/bookmarks — sync from X API using OAuth 2.0 token
export async function POST() {
  const token = getStoredToken();
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
    return NextResponse.json({
      bookmarks,
      counts,
      allCategories,
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
