"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatIndiaDate } from "@/lib/format-date";

export function CancelSubscription({ id }: { id: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function cancel() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/payments/subscription/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ internalSubscriptionId: id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(body.error ?? "We could not cancel right now. Nothing was changed."); setStep("idle"); return; }
      const until = typeof body.accessUntil === "string" ? formatIndiaDate(body.accessUntil) : null;
      setStatus(until ? `Renewal cancelled. Premium until ${until}.` : "Renewal cancelled. Premium stays until the end of your paid period.");
      setStep("done");
      router.refresh();
    } catch {
      setStatus("We could not cancel right now. Nothing was changed.");
      setStep("idle");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") return <p className="save-status" role="status">{status}</p>;
  if (step === "confirm") {
    return (
      <div className="cancel-confirm">
        <p>Cancel renewal? You will not be charged again, and you keep Premium until the end of the period you already paid for.</p>
        <button className="button button-dark" type="button" onClick={() => void cancel()} disabled={busy}>{busy ? "Cancelling…" : "Yes, cancel renewal"}</button>
        <button className="button button-secondary" type="button" onClick={() => setStep("idle")} disabled={busy}>Keep my plan</button>
      </div>
    );
  }
  return (
    <>
      <button className="button button-secondary" type="button" onClick={() => { setStatus(""); setStep("confirm"); }}>Cancel renewal</button>
      <p className="save-status" role="status">{status}</p>
    </>
  );
}
