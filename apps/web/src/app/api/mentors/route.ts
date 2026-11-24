import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
export async function GET() { const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to browse mentors." }, { status: 401 }); const snapshot = await adminDb.collection("mentors").where("published", "==", true).limit(100).get(); return NextResponse.json({ mentors: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) }, { headers: { "Cache-Control": "private, no-store" } }); }
