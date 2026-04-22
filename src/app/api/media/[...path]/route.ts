import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { resolveMediaPath, mimeFor } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rel = segments.join("/");
  const abs = resolveMediaPath(rel);
  if (!abs) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await fs.readFile(abs);
    return new NextResponse(data as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeFor(abs),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
