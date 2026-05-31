import { NextRequest, NextResponse } from "next/server";
import { classify } from "@/lib/classifier";
import { getUserRules, requireMobileUser, upsertCloudBookmarks } from "@/lib/mobile-db";
import { getValidCloudAccessToken } from "@/lib/mobile-oauth";
import { fetchBookmarksPage } from "@/lib/twitter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req);
    const body = await req.json().catch(() => ({}));
    const cursor = typeof body.cursor === "string" ? body.cursor : undefined;
    const token = await getValidCloudAccessToken(user.id);
    if (!token) {
      return NextResponse.json({ error: "X authorization expired" }, { status: 401 });
    }

    const page = await fetchBookmarksPage(token, cursor);
    const rules = await getUserRules(user.id);
    const classified = page.bookmarks.map((bookmark) => ({
      ...bookmark,
      category: classify(bookmark, rules),
    }));
    await upsertCloudBookmarks(user.id, classified);

    return NextResponse.json({
      synced: classified.length,
      nextCursor: page.nextCursor,
      done: !page.nextCursor,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync bookmarks";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
