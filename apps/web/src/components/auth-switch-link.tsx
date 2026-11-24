import Link from "next/link";

export function AuthSwitchLink({ signup, destination }: { signup: boolean; destination: string }) {
  const loginPath = destination === "/mentor" ? "/mentor/login" : destination === "/recruiter" ? "/recruiter/login" : "/login";
  const path = signup ? loginPath : "/signup";
  const href = `${path}?returnTo=${encodeURIComponent(destination)}`;
  return <p className="auth-note">{signup ? <>Already have an account? <Link href={href}>Sign in</Link></> : <>New to SuccessPro? <Link href={href}>Create an account</Link></>}</p>;
}
