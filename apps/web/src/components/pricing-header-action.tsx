import Link from "next/link";
import { getSessionUser } from "@/lib/session";

// Shows Dashboard to signed-in visitors and Sign in to everyone else. A failed session check falls back to Sign in.
export async function PricingHeaderAction() {
  let signedIn = false;
  try {
    signedIn = Boolean(await getSessionUser());
  } catch {
    signedIn = false;
  }
  return signedIn
    ? <Link className="button button-secondary" href="/dashboard">Dashboard</Link>
    : <Link className="button button-secondary" href="/login">Sign in</Link>;
}
