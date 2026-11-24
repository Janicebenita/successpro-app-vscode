import { NextRequest, NextResponse } from "next/server";

const unsafe = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const bearerOnlyPaths = ["/api/internal/", "/api/payments/razorpay-webhook"];

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "") || "https";
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/") || !unsafe.has(request.method)) return NextResponse.next();
  if (bearerOnlyPaths.some((path) => request.nextUrl.pathname.startsWith(path))) return NextResponse.next();
  const hasSession = Boolean(request.cookies.get("successpro_session")?.value);
  if (!hasSession) return NextResponse.next();
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== requestOrigin(request) || (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite))) {
    return NextResponse.json({ error: "This request was blocked because it did not come from the SuccessPro application." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
