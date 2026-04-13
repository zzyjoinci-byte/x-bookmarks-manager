import { NextRequest, NextResponse } from "next/server";
import { clearToken } from "@/lib/oauth";

export async function POST() {
  clearToken();
  return NextResponse.json({ ok: true });
}
