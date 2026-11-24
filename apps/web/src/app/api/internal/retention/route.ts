import { NextResponse } from "next/server";
import { verifyInternalAutomation } from "@/lib/internal-automation";
import { enforceRetention } from "@/lib/retention";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await verifyInternalAutomation(request))) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  return NextResponse.json(await enforceRetention());
}
