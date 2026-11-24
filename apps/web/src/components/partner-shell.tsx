import Link from "next/link";
import { Brand } from "./brand";
import { SignOutButton } from "./sign-out-button";

export function PartnerShell({ kind, children }: { kind: "recruiter" | "mentor"; children: React.ReactNode }) {
  return <div className="partner-shell"><header className="container partner-header"><Brand dark /><nav aria-label="Partner navigation"><Link href="/">SuccessPro home</Link><Link href={kind === "recruiter" ? "/recruiter" : "/mentor"}>{kind === "recruiter" ? "Hiring workspace" : "Mentor workspace"}</Link><SignOutButton /></nav></header><main className="container partner-content">{children}</main></div>;
}
