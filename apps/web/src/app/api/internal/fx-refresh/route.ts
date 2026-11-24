import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { verifyInternalAutomation } from "@/lib/internal-automation";
import { createMonthlyPriceBook, parseEcbReferenceXml, supportedBillingCurrencySchema } from "@/lib/price-book";

const ECB_DAILY_XML = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export async function POST(request: Request) {
  if (!(await verifyInternalAutomation(request))) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  try {
    const response = await fetch(ECB_DAILY_XML, { headers: { Accept: "application/xml", "User-Agent": "SuccessPro/1.0 FX reference ingestion" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!response.ok) throw new Error(`Reference source returned ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 500_000) throw new Error("Reference response exceeds its size limit");
    const fx = parseEcbReferenceXml(await response.text());
    const books = supportedBillingCurrencySchema.options.map((currency) => createMonthlyPriceBook({ currency, fx })).filter((book) => book.available);
    const batch = adminDb.batch();
    const now = FieldValue.serverTimestamp();
    batch.set(adminDb.collection("fx_rates").doc("latest"), { ...fx, updatedAt: now, schemaVersion: 1 });
    batch.set(adminDb.collection("fx_rates").doc(fx.asOf), { ...fx, createdAt: now, updatedAt: now, schemaVersion: 1 }, { merge: true });
    for (const book of books) batch.set(adminDb.collection("price_book").doc(`${book.version}_${book.currency}`), { ...book, createdAt: now, updatedAt: now, schemaVersion: 1 }, { merge: true });
    await batch.commit();
    return NextResponse.json({ ok: true, asOf: fx.asOf, currencies: books.map((book) => book.currency), priceBookVersion: books[0]?.version ?? null });
  } catch (error) {
    console.error("fx-reference-refresh-failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "The reference rates could not be refreshed. Existing valid prices remain unchanged." }, { status: 503 });
  }
}
