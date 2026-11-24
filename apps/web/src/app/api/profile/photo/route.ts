import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
const maxBytes = 2_000_000;
const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"]]);

function validSignature(bytes: Buffer, type: string) {
  return type === "image/jpeg" ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) : type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

export async function GET() {
  const user = await getSessionUser(); if (!user) return new NextResponse(null, { status: 401 });
  const profile = await adminDb.collection("profiles").doc(user.uid).get();
  const updatedAt = String(profile.data()?.profilePhotoUpdatedAt ?? ""); if (!updatedAt) return new NextResponse(null, { status: 404 });
  const bucket = adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET);
  const [files] = await bucket.getFiles({ prefix: `profiles/${user.uid}/photo.` }); const file = files[0];
  if (!file) return new NextResponse(null, { status: 404 });
  const [contents] = await file.download(); const contentType = file.metadata.contentType || "image/jpeg";
  return new NextResponse(new Uint8Array(contents), { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to update your profile photograph." }, { status: 401 });
  const file = (await request.formData()).get("photo"); if (!(file instanceof File) || !allowed.has(file.type) || file.size > maxBytes) return NextResponse.json({ error: "Choose a JPG or PNG photograph under 2 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer()); if (!validSignature(bytes, file.type)) return NextResponse.json({ error: "This file does not match its image type." }, { status: 400 });
  const extension = allowed.get(file.type)!; const bucket = adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET);
  await Promise.all((await bucket.getFiles({ prefix: `profiles/${user.uid}/photo.` }))[0].map((old) => old.delete({ ignoreNotFound: true })));
  await bucket.file(`profiles/${user.uid}/photo.${extension}`).save(bytes, { resumable: false, contentType: file.type, metadata: { cacheControl: "private, no-store", metadata: { ownerId: user.uid, purpose: "profile-photo" } } });
  const updatedAt = new Date().toISOString(); await adminDb.collection("profiles").doc(user.uid).set({ profilePhotoUpdatedAt: updatedAt }, { merge: true });
  return NextResponse.json({ updatedAt });
}

export async function DELETE() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to update your profile photograph." }, { status: 401 });
  await adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET).deleteFiles({ prefix: `profiles/${user.uid}/`, force: true });
  await adminDb.collection("profiles").doc(user.uid).set({ profilePhotoUpdatedAt: "" }, { merge: true });
  return NextResponse.json({ ok: true });
}
