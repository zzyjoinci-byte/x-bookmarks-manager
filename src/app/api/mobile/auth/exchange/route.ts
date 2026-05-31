import { NextRequest, NextResponse } from "next/server";
import { consumeLoginCode, createMobileSession } from "@/lib/mobile-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const user = await consumeLoginCode(code);
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired login code" }, { status: 401 });
    }

    const session = await createMobileSession(user.id);
    return NextResponse.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exchange auth code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
