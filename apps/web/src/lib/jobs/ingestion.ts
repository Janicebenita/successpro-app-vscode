import { FieldValue } from "firebase-admin/firestore";
import { jobRecordSchema, jobSourceSchema, type JobRecord } from "@successpro/contracts/jobs";
import { adminDb } from "@/lib/firebase-admin";
import { fetchJobsFromSource, postedWithinDays } from "./connectors";

export async function ingestConfiguredJobSources() {
  const builtIn = adminDb.collection("job_sources").doc("jobicy-public");
  if (!(await builtIn.get()).exists) {
    await builtIn.set({ ...jobSourceSchema.parse({ id: "jobicy-public", type: "jobicy", name: "Jobicy", employer: "", token: "", region: "global", countryCode: "us", location: "", enabled: true, termsReviewedOn: "2026-09-26", termsUrl: "https://jobicy.com/jobs-rss-feed" }), schemaVersion: 1, createdAt: FieldValue.serverTimestamp() });
  }
  const snapshots = await adminDb.collection("job_sources").where("enabled", "==", true).limit(8).get();
  const reports: Array<{ sourceId: string; fetched: number; saved: number; error?: string }> = [];
  for (const snapshot of snapshots.docs) {
    const parsed = jobSourceSchema.safeParse({ id: snapshot.id, ...snapshot.data() });
    if (!parsed.success) { reports.push({ sourceId: snapshot.id, fetched: 0, saved: 0, error: "Invalid source configuration" }); continue; }
    if (parsed.data.type === "jobicy") {
      const reserved = await adminDb.runTransaction(async (transaction) => {
        const current = await transaction.get(snapshot.ref);
        const last = Date.parse(String(current.data()?.lastAttemptAt ?? ""));
        if (Number.isFinite(last) && Date.now() - last < 60 * 60_000) return false;
        transaction.set(snapshot.ref, { lastAttemptAt: new Date().toISOString() }, { merge: true });
        return true;
      });
      if (!reserved) { reports.push({ sourceId: snapshot.id, fetched: 0, saved: 0 }); continue; }
    }
    try {
      const jobs = await fetchJobsFromSource(parsed.data);
      const existing = await adminDb.collection("jobs").where("sourceId", "==", parsed.data.id).get();
      const currentIds = new Set(jobs.map((job) => job.id));
      for (let offset = 0; offset < jobs.length; offset += 400) {
        const batch = adminDb.batch();
        const slice = jobs.slice(offset, offset + 400); const refs = slice.map((job) => adminDb.collection("jobs").doc(job.id)); const prior = await adminDb.getAll(...refs);
        slice.forEach((job, index) => batch.set(refs[index], { ...job, firstSeenOn: prior[index].data()?.firstSeenOn ?? job.firstSeenOn, updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1 }, { merge: true }));
        await batch.commit();
      }
      const stale = existing.docs.filter((doc) => !currentIds.has(doc.id));
      for (let offset = 0; offset < stale.length; offset += 400) { const batch = adminDb.batch(); stale.slice(offset, offset + 400).forEach((doc) => batch.set(doc.ref, { freshness: "closed", updatedAt: FieldValue.serverTimestamp() }, { merge: true })); await batch.commit(); }
      await snapshot.ref.set({ lastIngestedAt: new Date().toISOString(), lastCount: jobs.length, lastError: null }, { merge: true });
      reports.push({ sourceId: parsed.data.id, fetched: jobs.length, saved: jobs.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Source failed";
      await snapshot.ref.set({ lastIngestedAt: new Date().toISOString(), lastError: message }, { merge: true });
      reports.push({ sourceId: parsed.data.id, fetched: 0, saved: 0, error: message });
    }
  }
  return { sourceCount: snapshots.size, reports };
}

export async function currentJobs(limit = 200): Promise<JobRecord[]> {
  const snapshot = await adminDb.collection("jobs").where("freshness", "==", "current").limit(limit).get();
  const parsed = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).flatMap((value) => { const result = jobRecordSchema.safeParse(value); return result.success ? [result.data] : []; });
  const deduplicated = new Map<string, JobRecord>();
  for (const job of parsed.filter((job) => postedWithinDays(job.postedOn)).sort((a, b) => b.postedOn.localeCompare(a.postedOn))) if (!deduplicated.has(job.fingerprint)) deduplicated.set(job.fingerprint, job);
  return [...deduplicated.values()];
}
