import { NextResponse } from "next/server";
import { canonicalProfileSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { coverLetterDocumentRequestSchema } from "@/lib/document-request";
import { renderCoverLetterPdf } from "@/lib/document-renderer";
import { renderCoverLetterDocx } from "@/lib/document-docx-renderer";
import { getSessionUser } from "@/lib/session";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "coverLetterBuilder")) return NextResponse.json({ error: "Cover-letter-builder access is not included in your current plan." }, { status: 403 });
  const parsed = coverLetterDocumentRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Check the employer details and letter content before downloading." }, { status: 400 });
  const snapshot = await adminDb.collection("profiles").doc(user.uid).get();
  const profile = canonicalProfileSchema.safeParse(snapshot.data());
  if (!profile.success) return NextResponse.json({ error: "Complete and save your career profile before creating a cover letter." }, { status: 409 });
  const wordCount = parsed.data.letter.paragraphs.join(" ").trim().split(/\s+/).length;
  if (wordCount < 250 || wordCount > 450) return NextResponse.json({ error: "Keep the cover letter between 250 and 450 words." }, { status: 400 });
  const templatePhoto = parsed.data.templateId === "clarity" ? undefined : parsed.data.photoDataUri;
  const input = { ...parsed.data, photoDataUri: templatePhoto, profile: profile.data };
  const docx = new URL(request.url).searchParams.get("format") === "docx";
  const output = docx ? await renderCoverLetterDocx(input) : await renderCoverLetterPdf(input);
  const safeName = profile.data.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cover-letter";
  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": docx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-${parsed.data.templateId}-cover-letter.${docx ? "docx" : "pdf"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
