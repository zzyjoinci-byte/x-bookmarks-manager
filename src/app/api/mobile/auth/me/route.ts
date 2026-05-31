import { NextRequest, NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireMobileUser(req);
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
