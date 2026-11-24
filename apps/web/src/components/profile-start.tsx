import Link from "next/link";

export function ProfileStart({ nextPath }: { nextPath: string }) {
  return <div className="profile-start">
    <section className="work-card profile-intro"><div><span className="status-pill">LET’S BUILD YOUR PROFILE</span><h2>Start with your resume</h2><p>Upload your current resume and we’ll fill the first draft of your career profile. You’ll check and correct every detail before anything is saved.</p></div></section>
    <section className="profile-start-grid">
      <article className="work-card profile-start-card primary"><span aria-hidden="true">01</span><h3>I have a resume</h3><p>Upload a PDF, Word (.doc or .docx), or TXT file. We’ll extract your name, summary, skills, experience, education, and other details where available.</p><Link className="button button-primary" href={`/review?setup=profile&next=${encodeURIComponent(nextPath)}`}>Upload my resume</Link><small>Your original file and extracted details remain private.</small></article>
      <article className="work-card profile-start-card"><span aria-hidden="true">02</span><h3>I don’t have a resume</h3><p>Build your profile from scratch with a guided form. You can add experience, education, skills, projects, credentials, goals, and more.</p><Link className="button button-dark" href={`/profile?manual=1&next=${encodeURIComponent(nextPath)}`}>Enter my details manually</Link><small>You can upload a resume later without overwriting confirmed details.</small></article>
    </section>
  </div>;
}
