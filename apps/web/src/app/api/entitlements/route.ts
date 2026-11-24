import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your plan access." }, { status: 401 });
  return NextResponse.json(await resolveUserEntitlements(user.uid), { headers: { "Cache-Control": "private, no-store" } });
}
