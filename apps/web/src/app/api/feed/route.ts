import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { adminStorage } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { feedEventInputSchema } from "@/lib/feed";
import { feedForUser } from "@/lib/feed-service";
import { isValidFeedAttachmentSignature, safeFeedAttachmentName, supportedFeedAttachment, type FeedAttachment } from "@/lib/feed-attachments";

export async function GET() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view your professional feed." }, { status: 401 });
  return NextResponse.json({ events: await feedForUser(user.uid) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to share a professional update." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "feed-publish", limit: 10, windowSeconds: 86_400 });
  if (!rate.allowed) return NextResponse.json({ error: "You have shared several updates today. Try again tomorrow." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
  const form = isMultipart ? await request.formData().catch(() => null) : null;
  const candidate = form ? { category: form.get("category"), title: form.get("title"), details: form.get("details") } : await request.json().catch(() => null);
  const parsed = feedEventInputSchema.safeParse(candidate);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the update." }, { status: 400 });
  const profile = await adminDb.collection("public_profiles").where("ownerId", "==", user.uid).where("published", "==", true).limit(1).get();
  if (profile.empty) return NextResponse.json({ error: "Publish your professional profile before sharing network updates." }, { status: 409 });

  const file = form?.get("attachment");
  let attachment: FeedAttachment | undefined;
  let bytes: Buffer | undefined;
  if (file instanceof File && file.size > 0) {
    const supported = supportedFeedAttachment(file.type);
    if (!supported || file.size > supported.maxBytes) return NextResponse.json({ error: "Choose a JPG, PNG, WebP, PDF, MP4, WebM or MOV within the stated size limit." }, { status: 400 });
    bytes = Buffer.from(await file.arrayBuffer());
    if (!isValidFeedAttachmentSignature(bytes, file.type)) return NextResponse.json({ error: "This attachment does not match its file type." }, { status: 400 });
    const id = randomUUID();
    attachment = { id, name: safeFeedAttachmentName(file.name, supported.extension), mimeType: file.type, size: file.size, kind: supported.kind, objectName: `feed/${user.uid}/${id}.${supported.extension}` };
  }
  const id = randomUUID();
  try {
    if (attachment && bytes) await adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET).file(attachment.objectName).save(bytes, { resumable: false, contentType: attachment.mimeType, metadata: { cacheControl: "private, no-store", metadata: { ownerId: user.uid, purpose: "professional-feed" } } });
    await adminDb.collection("feed_events").doc(id).create({ id, ownerId: user.uid, ...parsed.data, ...(attachment ? { attachment } : {}), reactionCounts: { celebrate: 0, support: 0, insightful: 0 }, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), schemaVersion: 2 });
  } catch (error) {
    if (attachment) await adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET).file(attachment.objectName).delete({ ignoreNotFound: true }).catch(() => undefined);
    console.error("feed event publish failed", error);
    return NextResponse.json({ error: "We could not share this update. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
