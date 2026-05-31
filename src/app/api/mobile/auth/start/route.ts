import { NextResponse } from "next/server";
import { buildMobileAuthUrl } from "@/lib/mobile-oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const url = await buildMobileAuthUrl();
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start auth";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
