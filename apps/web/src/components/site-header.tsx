import Link from "next/link";
import { Brand } from "./brand";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container inner">
        <Brand />
        <nav aria-label="Main navigation">
          <Link className="nav-link" href="#how-it-works">How it works</Link>
          <Link className="nav-link" href="#privacy">Privacy</Link>
          <Link className="nav-link" href="/pricing">Pricing</Link>
          <Link className="button button-secondary" href="/login">Sign in</Link>
          <Link className="button button-primary" href="/signup">Start free</Link>
        </nav>
      </div>
    </header>
  );
}
