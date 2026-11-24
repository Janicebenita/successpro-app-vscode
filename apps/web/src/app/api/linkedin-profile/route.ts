import { NextResponse } from "next/server";
import { validateResumeUpload } from "@successpro/domain";
import { getSessionUser } from "@/lib/session";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "linkedInMakeover")) return NextResponse.json({ error: "LinkedIn guidance is not included in your current plan." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("profile");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the PDF downloaded from your LinkedIn profile." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateResumeUpload({ name: file.name, mimeType: file.type, size: file.size, signature: bytes.slice(0, 4) });
  if (!validation.valid || validation.kind !== "pdf") return NextResponse.json({ error: "Upload a valid LinkedIn profile PDF up to 10 MB." }, { status: 400 });
  try {
    const canvas = await import("@napi-rs/canvas");
    const globals = globalThis as unknown as Record<string, unknown>;
    globals.DOMMatrix ??= canvas.DOMMatrix; globals.ImageData ??= canvas.ImageData; globals.Path2D ??= canvas.Path2D;
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.replace(/\u0000/g, "").trim();
    if (text.length < 80) return NextResponse.json({ error: "We could not find enough readable profile text in that PDF." }, { status: 422 });
    return NextResponse.json({ text: text.slice(0, 100_000), pageCount: result.total, message: "Profile PDF read successfully. The comparison below uses the visible text in this file." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "We could not read that PDF. Download a fresh profile PDF from LinkedIn and try again." }, { status: 422 });
  }
}
