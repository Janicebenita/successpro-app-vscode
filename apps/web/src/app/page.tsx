import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "AI Resume Checker & Career Growth Workspace",
  description:
    "Turn career history into clear direction. Evaluate your resume with AI-driven ATS checks, timeline gap risk analysis, and role-fit matching.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">Your career growth workspace</span>
              <h1>Turn your career history into <span>clear direction.</span></h1>
              <p className="hero-copy">Understand how your resume comes across, strengthen your professional story, and take the next step with confidence.</p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/signup">Check my resume <span aria-hidden="true">→</span></Link>
                <Link className="button button-secondary" href="/dashboard">Explore the workspace</Link>
              </div>
              <div className="trust-row"><span>3 free reviews each month</span><span>Private by default</span><span>Clear, honest feedback</span></div>
            </div>
            <div className="dashboard-preview" aria-label="SuccessPro workspace preview">
              <div className="preview-card">
                <div className="preview-top"><span>Resume Checker</span><span>SuccessPro score</span></div>
                <div className="preview-body">
                  <div className="preview-panel">
                    <h3>Overall resume score</h3>
                    <div className="score-ring"><span>82</span></div>
                    <p>A strong start. Add numbers and results to show the value of your work.</p>
                  </div>
                  <div className="preview-stats">
                    <div className="stat"><strong>9/12</strong><span>areas looking good</span></div>
                    <div className="stat"><strong>74%</strong><span>match for the role</span></div>
                    <div className="stat"><strong>3</strong><span>improvements to start with</span></div>
                  </div>
                </div>
              </div>
              <div className="next-action"><strong>Best next step</strong><span>Add clear results to your two most recent roles.</span></div>
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="container">
            <div className="section-heading"><span className="feature-number">HOW IT WORKS</span><h2>From career history to your next best move.</h2><p>One connected workspace keeps your resume, goals, job fit, and professional story aligned.</p></div>
            <div className="feature-grid">
              <article className="feature-card"><span className="feature-number">01 - UNDERSTAND</span><h3>See what your resume communicates</h3><p>Get a clear score, see what is working, and know which improvements to make first.</p></article>
              <article className="feature-card"><span className="feature-number">02 - IMPROVE</span><h3>Build a stronger career profile</h3><p>Bring your experience, skills, education, and achievements together in one place.</p></article>
              <article className="feature-card"><span className="feature-number">03 - ADVANCE</span><h3>Plan your next career move</h3><p>Set goals, understand skill gaps, and check how well your resume fits a role.</p></article>
            </div>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="container privacy-strip">
            <div><h2>Your career information is personal. We treat it that way.</h2><p>Your profile stays private unless you choose to share it, and your contact details are hidden by default.</p></div>
            <Link className="button button-primary" href="/signup">Create private workspace</Link>
          </div>
        </section>
      </main>
    </>
  );
}
