import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// Reports only the signed-in user's own paid status. Test-email access is not counted as paid.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to check your subscription." }, { status: 401, headers });
  try {
    const access = await resolveUserEntitlements(user.uid);
    const active = access.planId !== "free" && !access.testAccess;
    return NextResponse.json({ active, planId: active ? access.planId : "free", activeUntil: active ? access.activeUntil : null }, { headers });
  } catch {
    return NextResponse.json({ error: "Status is unavailable right now." }, { status: 503, headers });
  }
}
