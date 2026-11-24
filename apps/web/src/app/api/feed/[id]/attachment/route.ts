import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { canViewFeedEvent } from "@/lib/feed-service";
import { getSessionUser } from "@/lib/session";
import type { FeedAttachment } from "@/lib/feed-attachments";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this attachment." }, { status: 401 });
  const { id } = await params;
  const event = await adminDb.collection("feed_events").doc(id).get();
  const value = event.data();
  const attachment = value?.attachment as FeedAttachment | undefined;
  if (!event.exists || !attachment || !value?.ownerId || !(await canViewFeedEvent(user.uid, String(value.ownerId)))) return new NextResponse(null, { status: 404 });
  if (!attachment.objectName.startsWith(`feed/${value.ownerId}/`)) return new NextResponse(null, { status: 404 });
  const file = adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET).file(attachment.objectName);
  const [exists] = await file.exists();
  if (!exists) return new NextResponse(null, { status: 404 });
  const [contents] = await file.download();
  const disposition = attachment.kind === "document" ? `attachment; filename="${attachment.name.replace(/["\\]/g, "_")}"` : "inline";
  return new NextResponse(new Uint8Array(contents), { headers: { "Content-Type": attachment.mimeType, "Content-Length": String(contents.byteLength), "Content-Disposition": disposition, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
