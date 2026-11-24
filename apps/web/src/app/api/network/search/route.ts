import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { networkSearchMatches, networkSuggestion, type NetworkProfile } from "@/lib/network";

export async function GET(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to search the professional network." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const [snapshot, viewerSnapshot] = await Promise.all([adminDb.collection("public_profiles").where("published", "==", true).limit(500).get(), adminDb.collection("profiles").doc(user.uid).get()]);
  const viewer = viewerSnapshot.data() ?? {};
  const profiles = snapshot.docs.map((doc) => { const value = doc.data(); const experience = Array.isArray(value.experience) ? value.experience as Array<Record<string, unknown>> : []; return { id: doc.id, ownerId: String(value.ownerId ?? ""), fullName: String(value.fullName ?? ""), headline: String(value.headline ?? ""), currentRole: String(value.currentRole ?? ""), employer: String(experience[0]?.employer ?? ""), industry: String(value.industry ?? ""), location: String(value.location ?? ""), skills: Array.isArray(value.skills) ? value.skills.map(String) : [], published: Boolean(value.published) } satisfies NetworkProfile; }).filter((profile) => profile.ownerId && profile.ownerId !== user.uid && networkSearchMatches(profile, query)).map((profile) => ({ ...profile, ...networkSuggestion(profile, viewer) })).sort((a, b) => query ? a.fullName.localeCompare(b.fullName) : b.score - a.score).slice(0, 50);
  return NextResponse.json({ profiles, mode: query ? "search" : "suggestions" }, { headers: { "Cache-Control": "private, no-store" } });
}
