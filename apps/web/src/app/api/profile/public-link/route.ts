import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { canonicalProfileSchema } from "@successpro/contracts";
import { publicProfileProjection } from "@/lib/public-profile";
import { createNotification } from "@/lib/notifications";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

  const profileRef = adminDb.collection("profiles").doc(user.uid);
  const newPublicProfileId = `sp-${randomBytes(8).toString("hex")}`;
  const result = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    const parsed = canonicalProfileSchema.safeParse(snapshot.data());
    if (!snapshot.exists || !parsed.success) return { status: 404, error: "Save your career profile before creating a new sharing link." };
    const stored = snapshot.data()!;
    const profile = parsed.data;
    if (!profile.publicProfileEnabled) return { status: 409, error: "Turn on your public profile before creating a new sharing link." };

    const oldPublicProfileId = typeof stored.publicProfileId === "string" ? stored.publicProfileId : null;
    const now = FieldValue.serverTimestamp();
    const publicRecord = {
      id: newPublicProfileId,
      ownerId: user.uid,
      published: true,
      ...publicProfileProjection(parsed.data),
      updatedAt: now,
      createdAt: now,
      schemaVersion: 1,
    };
    transaction.set(adminDb.collection("public_profiles").doc(newPublicProfileId), publicRecord);
    transaction.set(profileRef, { publicProfileId: newPublicProfileId, updatedAt: now }, { merge: true });
    if (oldPublicProfileId) transaction.set(adminDb.collection("public_profiles").doc(oldPublicProfileId), { published: false, openToWork: false, revokedAt: now, updatedAt: now }, { merge: true });
    return { status: 200 };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  await createNotification({ ownerId: user.uid, category: "privacy", title: "Public profile link updated", message: "A new public career-profile link is active. Any previous sharing link has been disabled.", href: "/profile", dedupeKey: `public-profile-${newPublicProfileId}` }).catch(() => undefined);
  return NextResponse.json({ ok: true, publicProfileId: newPublicProfileId });
}
