import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^sp-[a-f0-9]{16}$/.test(id)) return new NextResponse(null, { status: 404 });
  const publicProfile = await adminDb.collection("public_profiles").doc(id).get();
  const publicData = publicProfile.data();
  if (!publicProfile.exists || publicData?.published !== true || publicData?.photoPublic !== true || typeof publicData.ownerId !== "string") return new NextResponse(null, { status: 404 });
  const privateProfile = await adminDb.collection("profiles").doc(publicData.ownerId).get();
  if (!privateProfile.data()?.profilePhotoUpdatedAt) return new NextResponse(null, { status: 404 });
  const bucket = adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET);
  const [files] = await bucket.getFiles({ prefix: `profiles/${publicData.ownerId}/photo.` });
  const file = files[0];
  if (!file) return new NextResponse(null, { status: 404 });
  const [contents] = await file.download();
  const contentType = file.metadata.contentType === "image/png" ? "image/png" : "image/jpeg";
  return new NextResponse(new Uint8Array(contents), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
