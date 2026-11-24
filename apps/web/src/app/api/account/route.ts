import { NextResponse } from "next/server";
import { deleteAccountData } from "@/lib/account-deletion";
import { requireRecentIdentity, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const user = await requireRecentIdentity(request);
  if (!user) return NextResponse.json({ error: "Confirm your identity again before deleting your account." }, { status: 401 });
  try {
    const result = await deleteAccountData(user.uid);
    const response = NextResponse.json({ ok: true, ...result });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "Account deletion could not finish. No new processing will be started; contact privacy support with the time of this attempt." }, { status: 500 });
  }
}
