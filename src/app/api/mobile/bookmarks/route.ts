import { NextRequest, NextResponse } from "next/server";
import { listCloudBookmarks, requireMobileUser } from "@/lib/mobile-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireMobileUser(req);
    const result = await listCloudBookmarks({
      userId: user.id,
      category: req.nextUrl.searchParams.get("category") || undefined,
      query: req.nextUrl.searchParams.get("query") || undefined,
      cursor: req.nextUrl.searchParams.get("cursor") || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load bookmarks";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
