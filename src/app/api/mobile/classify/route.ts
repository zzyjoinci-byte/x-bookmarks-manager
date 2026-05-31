import { NextRequest, NextResponse } from "next/server";
import { classifyMany } from "@/lib/classifier";
import { batchUpdateCloudCategories, getAllCloudBookmarksForClassify, getUserRules, requireMobileUser } from "@/lib/mobile-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req);
    const items = await getAllCloudBookmarksForClassify(user.id);
    const rules = await getUserRules(user.id);
    const updates = classifyMany(items, rules);
    await batchUpdateCloudCategories(user.id, updates);
    return NextResponse.json({ reclassified: updates.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to classify bookmarks";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
