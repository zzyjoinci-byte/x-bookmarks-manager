import { NextRequest, NextResponse } from "next/server";
import { revokeMobileSession } from "@/lib/mobile-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) await revokeMobileSession(match[1]);
  return NextResponse.json({ ok: true });
}
