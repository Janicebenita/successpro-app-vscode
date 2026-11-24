import { OAuth2Client } from "google-auth-library";

const verifier = new OAuth2Client();

export async function verifyInternalAutomation(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  const legacySecret = process.env.JOB_AUTOMATION_SECRET;
  if (legacySecret && token === legacySecret) return true;
  const expectedEmail = process.env.AUTOMATION_SERVICE_ACCOUNT_EMAIL;
  if (!expectedEmail) return false;
  try {
    const audience = process.env.AUTOMATION_OIDC_AUDIENCE || new URL(request.url).origin;
    const ticket = await verifier.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    return payload?.email_verified === true && payload.email === expectedEmail;
  } catch {
    return false;
  }
}
