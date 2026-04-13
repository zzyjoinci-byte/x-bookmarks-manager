import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?error=Missing+code+or+state", req.url)
    );
  }

  try {
    await exchangeCodeForToken(code, state);
    return NextResponse.redirect(new URL("/?auth=success", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
