import Link from "next/link";
import { formatIndiaDate } from "@/lib/format-date";

// Shown once after a successful payment. The page decides whether to render it; this only displays the message.
export function SubscribedBanner({ activeUntil }: { activeUntil: string | null }) {
  const date = activeUntil ? formatIndiaDate(activeUntil) : null;
  return (
    <section className="work-card" role="status">
      <h3>Premium is active</h3>
      <p>{date ? `Your plan renews on ${date}.` : "Your plan is now active."} <Link href="/billing">View billing</Link></p>
    </section>
  );
}
