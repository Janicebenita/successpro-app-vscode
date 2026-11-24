import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { ingestConfiguredJobSources } from "@/lib/jobs/ingestion";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to refresh job sources." }, { status: 401 });
  const throttleRef = adminDb.collection("job_refresh_requests").doc(user.uid);
  const allowed = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(throttleRef);
    const last = snapshot.data()?.requestedAt?.toDate?.() as Date | undefined;
    if (last && Date.now() - last.valueOf() < 15 * 60_000) return false;
    transaction.set(throttleRef, { ownerId: user.uid, requestedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!allowed) return NextResponse.json({ error: "Sources were checked recently. Try again in a few minutes." }, { status: 429 });
  const result = await ingestConfiguredJobSources();
  return NextResponse.json(result);
}
