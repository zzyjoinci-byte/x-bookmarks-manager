import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/oauth";

export async function GET() {
  try {
    const authUrl = buildAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
