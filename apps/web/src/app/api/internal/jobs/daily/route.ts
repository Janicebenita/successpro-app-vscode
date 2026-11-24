import { NextResponse } from "next/server";
import { buildDailyJobFeeds } from "@/lib/jobs/daily-feed";
import { ingestConfiguredJobSources } from "@/lib/jobs/ingestion";
import { verifyInternalAutomation } from "@/lib/internal-automation";

export async function POST(request: Request) {
  if (!(await verifyInternalAutomation(request))) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  const ingestion = await ingestConfiguredJobSources(); const feeds = await buildDailyJobFeeds();
  return NextResponse.json({ ingestion, feeds });
}
