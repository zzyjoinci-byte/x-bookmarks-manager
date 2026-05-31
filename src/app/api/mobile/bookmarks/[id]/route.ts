import { NextRequest, NextResponse } from "next/server";
import { getCloudBookmark, requireMobileUser, updateCloudBookmarkCategory } from "@/lib/mobile-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMobileUser(req);
    const { id } = await context.params;
    const bookmark = await getCloudBookmark(user.id, id);
    if (!bookmark) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ bookmark });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load bookmark";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMobileUser(req);
    const { id } = await context.params;
    const { category } = await req.json();
    if (!category || typeof category !== "string") {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }
    await updateCloudBookmarkCategory(user.id, id, category);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update bookmark";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
