"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { SignOutButton } from "./sign-out-button";
import { ExternalAiConsent } from "./external-ai-consent";

const userItems = [
  ["Overview", "/dashboard", "home"],
  ["My resume", "/review", "resume"],
  ["Resume & cover letter builder", "/documents", "resume"],
  ["Hire an expert writer", "/billing", "profile"],
  ["LinkedIn makeover", "/linkedin", "profile"],
  ["Career goals", "/goals", "target"],
  ["Salary benchmarking", "/salary", "jobs"],
  ["Learning plan", "/learning", "target"],
  ["Opportunities", "/opportunities", "jobs"],
  ["All recruiter jobs", "/jobs", "jobs"],
  ["Professional network", "/network", "users"],
  ["Professional feed", "/feed", "flag"],
  ["Mentorship", "/mentors", "users"],
  ["Messages", "/messages", "messages"],
  ["Notifications", "/notifications", "flag"],
  ["My profile", "/profile", "profile"],
  ["Privacy & account", "/settings", "settings"],
  ["Help & support", "/help", "messages"],
] as const;

const adminItems = [
  ["Control center", "/admin", "home"],
  ["Payments & revenue", "/admin#payments", "audit"],
  ["AI operations", "/admin#ai", "settings"],
  ["Growth tracking", "/admin#growth", "flag"],
  ["Member access", "/admin#users", "users"],
  ["Trust & safety", "/admin#trust", "shield"],
  ["Billing recovery", "/admin/payments", "audit"],
] as const;

export function AppShell({ children, admin = false, adminAccess = false }: { children: React.ReactNode; admin?: boolean; adminAccess?: boolean }) {
  const items = admin ? adminItems : adminAccess ? [...userItems, ["Admin center", "/admin", "shield"] as const] : userItems;
  const pathname = usePathname();
  const currentPage = items.find(([, href]) => href === pathname)?.[0] || "Career workspace";
  const [aiConsentAccepted, setAiConsentAccepted] = useState<boolean | null>(null);
  useEffect(() => {
    if (admin) return;
    let active = true;
    fetch("/api/account/ai-consent", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((body) => { if (active && body) setAiConsentAccepted(body.accepted === true); }).catch(() => undefined);
    const accepted = () => setAiConsentAccepted(true);
    window.addEventListener("successpro:ai-consent-accepted", accepted);
    return () => { active = false; window.removeEventListener("successpro:ai-consent-accepted", accepted); };
  }, [admin]);
  return (
    <div className={`shell${admin ? " admin" : ""}`}>
      <aside className="sidebar">
        <Brand />
        <nav className="sidebar-nav" aria-label={admin ? "Admin navigation" : "Application navigation"}>
          {items.map(([label, href, icon]) => (
            <Link href={href} key={label} aria-label={label} aria-current={pathname === href ? "page" : undefined}>
              <Icon name={icon} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">Private workspace<br /><SignOutButton /></div>
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <h1>{admin ? "Admin console" : currentPage}</h1>
          <Link className="workspace-profile-link" href="/profile">My profile ↗</Link>
        </header>
        {!admin && <details className="mobile-workspace-menu"><summary>Explore your workspace</summary><nav aria-label="Mobile workspace navigation">{items.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav></details>}
        <main className="workspace">
          {!admin && aiConsentAccepted === false && <section className="work-card ai-consent-banner" role="region" aria-label="Required data-use confirmation"><div><span className="status-pill">ACTION REQUIRED</span><h2>Confirm how your career information may be processed</h2><p>Accept the current data-use terms once to use Resume Checker, resume transformation, cover-letter writing, LinkedIn guidance, and other expert career tools.</p></div><ExternalAiConsent accepted={false} onAccepted={() => setAiConsentAccepted(true)} /></section>}
          {children}
        </main>
      </div>
    </div>
  );
}
