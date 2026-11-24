import { NextResponse } from "next/server";
import { canonicalProfileSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { resumeDocumentRequestSchema } from "@/lib/document-request";
import { renderResumePdf } from "@/lib/document-renderer";
import { renderResumeDocx } from "@/lib/document-docx-renderer";
import { getSessionUser } from "@/lib/session";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "resumeBuilder")) return NextResponse.json({ error: "Resume-builder access is not included in your current plan." }, { status: 403 });
  const parsed = resumeDocumentRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Check the document options and contact details before downloading." }, { status: 400 });
  const snapshot = await adminDb.collection("profiles").doc(user.uid).get();
  const profile = canonicalProfileSchema.safeParse(snapshot.data());
  if (!profile.success) return NextResponse.json({ error: "Complete and save your career profile before creating a resume." }, { status: 409 });
  const templatePhoto = parsed.data.templateId === "clarity" ? undefined : parsed.data.photoDataUri;
  const input = { ...parsed.data, photoDataUri: templatePhoto, profile: profile.data };
  const docx = new URL(request.url).searchParams.get("format") === "docx";
  const output = docx ? await renderResumeDocx(input) : await renderResumePdf(input);
  const safeName = profile.data.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume";
  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": docx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-${parsed.data.templateId}-resume.${docx ? "docx" : "pdf"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
