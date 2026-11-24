"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open(): void } } }

async function loadCheckout() {
  if (window.Razorpay) return true;
  return await new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function SubscribeButton({ planId, label, planName, className }: { planId: "premium-monthly" | "premium-quarterly" | "premium-annual"; label: string; planName: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState(false);
  const paid = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);

  // After payment, ask our server every 2 seconds whether Premium is active. Give up after 30 seconds.
  function confirmPayment() {
    paid.current = true;
    setConfirming(true);
    setStatus("Confirming your payment…");
    const startedAt = Date.now();
    const check = async () => {
      if (!alive.current) return;
      try {
        const response = await fetch("/api/payments/subscription/status", { cache: "no-store" });
        const body = response.ok ? await response.json().catch(() => ({})) : {};
        if (body.active === true) { router.push("/dashboard?subscribed=1"); return; }
      } catch { /* try again below */ }
      if (!alive.current) return;
      if (Date.now() - startedAt >= 30_000) {
        setConfirming(false);
        setStatus("We are still confirming your payment. You will not be charged twice. Check the Billing page for the status.");
        return;
      }
      timer.current = setTimeout(() => void check(), 2_000);
    };
    void check();
  }

  async function subscribe() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/payments/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, currency: "INR" }) });
      if (response.status === 401) { router.push("/login?returnTo=/pricing"); return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(body.error ?? "Checkout could not start. No charge was made."); return; }
      if (!(await loadCheckout()) || !window.Razorpay) { setStatus("Checkout could not load. No charge was made."); return; }
      new window.Razorpay({
        key: body.keyId,
        subscription_id: body.subscriptionId,
        name: "SuccessPro",
        description: planName,
        handler: () => confirmPayment(),
        modal: { ondismiss: () => { if (!paid.current) setStatus("Checkout closed. No completed payment was recorded."); } },
        theme: { color: "#153b66" },
      }).open();
    } catch {
      setStatus("Checkout could not start. No charge was made.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={() => void subscribe()} disabled={busy || confirming}>{busy ? "Opening checkout…" : confirming ? "Confirming…" : label}</button>
      <p className="save-status" role="status">{status}</p>
    </>
  );
}
