import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { addonIdSchema, addonPrice } from "@/lib/addon-pricing";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { razorpayOrderPayload } from "@/lib/payment-order";
import { resolveBillingConfig } from "@/lib/billing-config";

const inputSchema = z.object({ addonId: addonIdSchema, currency: z.string().length(3) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to purchase a writing service." }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid writing service." }, { status: 400 });
  if (parsed.data.currency.toUpperCase() !== "INR") return NextResponse.json({ error: "Writing services are available in Indian rupees only for now. No charge was made." }, { status: 409 });
  const price = addonPrice(parsed.data.addonId, parsed.data.currency);
  if (!price) return NextResponse.json({ error: "A current price is not available in that currency. Choose INR or try again after the price book is updated." }, { status: 409 });
  const billing = resolveBillingConfig();
  if (!billing.enabled) return NextResponse.json({ error: "Secure checkout is not open yet. Your selection has not been charged." }, { status: 503 });
  const keyId = billing.keyId; const secret = billing.keySecret;
  const reference = adminDb.collection("addon_orders").doc();
  const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify(razorpayOrderPayload({ amount: price.amount, currency: price.currency, internalOrderId: reference.id, addonId: parsed.data.addonId })), cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return NextResponse.json({ error: "Secure checkout could not be started. No charge was made." }, { status: 502 });
  const order = await response.json() as { id?: unknown };
  if (typeof order.id !== "string" || !order.id.startsWith("order_")) return NextResponse.json({ error: "The payment provider returned an invalid order. No charge was made." }, { status: 502 });
  await reference.set({ id: reference.id, ownerId: user.uid, addonId: parsed.data.addonId, amount: price.amount, currency: price.currency, fxRate: price.fxRate, fxAsOf: price.fxAsOf, pricingVersion: price.pricingVersion, razorpayOrderId: order.id, state: "created", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  return NextResponse.json({ keyId, orderId: order.id, internalOrderId: reference.id, amount: price.amount, currency: price.currency, name: price.name, description: price.description });
}
