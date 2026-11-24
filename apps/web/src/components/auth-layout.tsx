import { Suspense } from "react";
import { Brand } from "./brand";
import { AuthForm } from "./auth-form";

export function AuthLayout({ mode, audience }: { mode: "login" | "signup"; audience?: "recruiter" | "mentor" }) {
  const signup = mode === "signup";
  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="SuccessPro introduction">
        <Brand />
        <div className="auth-aside-content">
          <span className="eyebrow">Private by design</span>
          <h1>Your career story, <span>working harder.</span></h1>
          <p>Turn experience into a clearer professional profile, practical next steps, and opportunities that fit.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>{audience === "recruiter" ? "Recruiter sign in" : audience === "mentor" ? "Mentor sign in" : signup ? "Create your account" : "Welcome back"}</h2>
          <p>{audience ? "Sign in to your dedicated workspace. SuccessPro reviews applications before jobs or services can be published." : signup ? "Start with a free, private career workspace." : "Continue building your next career move."}</p>
          <Suspense fallback={<p className="auth-note">Loading sign-in…</p>}><AuthForm mode={mode} defaultDestination={audience ? `/${audience}` : "/dashboard"} /></Suspense>
        </div>
      </section>
    </main>
  );
}
