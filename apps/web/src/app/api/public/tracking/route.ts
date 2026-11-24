import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function identifier(value: unknown) { return typeof value === "string" ? value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80) : ""; }

export async function GET() {
  const snapshot = await adminDb.collection("system_config").doc("admin_operational_settings").get().catch(() => null);
  const tracking = snapshot?.data()?.tracking ?? {};
  return NextResponse.json({ googleAnalyticsId: identifier(tracking.googleAnalyticsId), googleTagManagerId: identifier(tracking.googleTagManagerId), googleAdsId: identifier(tracking.googleAdsId), metaPixelId: identifier(tracking.metaPixelId), linkedInInsightTagId: identifier(tracking.linkedInInsightTagId) }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } });
}
