import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "successpro_session";

export async function getSessionUser(options: { allowWithdrawn?: boolean } = {}) {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) {
    if (process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true") {
      return {
        uid: "local-developer",
        email: "demo@successpro.local",
        email_verified: true,
        name: "Demo Developer",
        picture: "",
        iss: "https://securetoken.google.com/successpro",
        aud: "successpro",
        auth_time: Math.floor(Date.now() / 1000),
        sub: "local-developer",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        firebase: { identities: {}, sign_in_provider: "password" },
      } as unknown as import("firebase-admin/auth").DecodedIdToken;
    }
    return null;
  }
  try {
    const user = await adminAuth.verifySessionCookie(session, true);
    if (!options.allowWithdrawn) {
      const account = await (await import("./firebase-admin")).adminDb.collection("users").doc(user.uid).get();
      if (account.data()?.processingConsentStatus === "withdrawn") return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function requireRecentIdentity(request: Request, maximumAgeSeconds = 300) {
  const sessionUser = await getSessionUser({ allowWithdrawn: true });
  const authorization = request.headers.get("authorization");
  if (!sessionUser || !authorization?.startsWith("Bearer ")) return null;
  try {
    const identity = await adminAuth.verifyIdToken(authorization.slice(7), true);
    const authenticationTime = Number(identity.auth_time ?? 0);
    if (identity.uid !== sessionUser.uid || !authenticationTime || Math.floor(Date.now() / 1000) - authenticationTime > maximumAgeSeconds) return null;
    return identity;
  } catch {
    return null;
  }
}
