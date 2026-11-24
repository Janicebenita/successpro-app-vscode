import React from "react";
import { ImageResponse } from "next/og";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";

export const runtime = "nodejs";

async function publishedPhotoDataUri(profile: Record<string, unknown>) {
  if (profile.photoPublic !== true || typeof profile.ownerId !== "string") return null;
  const owner = await adminDb.collection("profiles").doc(profile.ownerId).get();
  if (!owner.data()?.profilePhotoUpdatedAt) return null;
  const [files] = await adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET).getFiles({ prefix: `profiles/${profile.ownerId}/photo.` });
  const file = files[0];
  if (!file) return null;
  const [contents] = await file.download();
  const contentType = file.metadata.contentType === "image/png" ? "image/png" : "image/jpeg";
  return `data:${contentType};base64,${contents.toString("base64")}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const portrait = new URL(request.url).searchParams.get("format") === "portrait";
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (!/^sp-[a-f0-9]{16}$/.test(id)) return new Response("Not found", { status: 404 });
  const snapshot = await adminDb.collection("public_profiles").doc(id).get();
  const profile = snapshot.data();
  if (!snapshot.exists || !profile?.published) return new Response("Not found", { status: 404 });
  const access = await resolveUserEntitlements(profile.ownerId);
  const premium = access.planId !== "free";
  const colors = premium ? { background: "#101720", text: "#f5f7fa", accent: "#dac9a8", muted: "#b7c5d5", tile: "#293849" } : { background: "#f5f7fa", text: "#182333", accent: "#315d87", muted: "#52677d", tile: "#e2eaf3" };
  const initials = String(profile.fullName).split(" ").map((part) => part[0]).slice(0, 2).join("");
  const skills = (profile.skills ?? []).slice(0, 8).join("  ·  ");
  const photo = await publishedPhotoDataUri(profile).catch(() => null);
  const portraitTile = React.createElement("div", { style: { width: portrait ? 180 : 150, height: portrait ? 180 : 150, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 40, background: colors.tile, color: colors.accent, fontSize: portrait ? 68 : 58, fontWeight: 800 } }, photo ? React.createElement("img", { src: photo, width: portrait ? 180 : 150, height: portrait ? 180 : 150, style: { width: "100%", height: "100%", objectFit: "cover" } }) : initials);
  return new ImageResponse(React.createElement("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: portrait ? "90px" : "80px", background: colors.background, color: colors.text, fontFamily: "sans-serif" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, React.createElement("div", { style: { color: colors.accent, fontSize: 34, fontWeight: 800 } }, "SuccessPro"), profile.openToWork ? React.createElement("div", { style: { padding: "12px 22px", borderRadius: 999, background: "#e8f7f0", color: "#0b6b48", fontSize: 22, fontWeight: 800 } }, "OPEN TO WORK") : null),
    React.createElement("div", { style: { display: "flex", flexDirection: portrait ? "column" : "row", alignItems: portrait ? "flex-start" : "center", gap: portrait ? 54 : 42 } }, portraitTile, React.createElement("div", { style: { display: "flex", flexDirection: "column" } }, React.createElement("div", { style: { fontSize: portrait ? 72 : 62, fontWeight: 850, letterSpacing: "-3px" } }, profile.fullName), React.createElement("div", { style: { marginTop: 10, color: colors.text, fontSize: portrait ? 38 : 32 } }, profile.headline), React.createElement("div", { style: { marginTop: 12, color: colors.muted, fontSize: portrait ? 28 : 24 } }, [profile.currentRole, profile.industry, profile.location].filter(Boolean).join(" · ")))),
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 18 } }, React.createElement("div", { style: { color: colors.accent, fontSize: 23, fontWeight: 700 } }, skills), React.createElement("div", { style: { color: colors.muted, fontSize: 19 } }, "Discover the experience behind the person · SuccessPro"))
  ), { width: portrait ? 1080 : 1200, height: portrait ? 1350 : 630, headers: { "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${id}-successpro-${portrait ? "portrait" : "landscape"}.png"`, "Cache-Control": "private, no-store" } });
}
