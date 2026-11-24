import Link from "next/link";
import { Brand } from "./brand";

const policies = [
  ["Terms", "/terms"], ["Data policy", "/data-policy"], ["Cookie policy", "/cookie-policy"],
  ["Cancellation", "/cancellation-policy"], ["Refunds", "/refund-policy"], ["Digital delivery", "/delivery-policy"], ["Contact", "/contact"],
] as const;

export function SiteFooter() {
  return <footer className="site-footer"><div className="container inner"><div><Brand dark /><small>© 2026 SuccessPro - An X Factor Initiative.</small></div><div><nav className="footer-links" aria-label="Policies and support">{policies.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><nav className="footer-links footer-partners" aria-label="Partner workspaces"><Link href="/recruiter/login">For recruiters</Link><Link href="/mentor/login">Become a mentor</Link></nav></div></div></footer>;
}
