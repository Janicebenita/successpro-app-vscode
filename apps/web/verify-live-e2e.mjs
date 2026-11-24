import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const BASE_URL = "http://localhost:3000";
const PDF_PATH = "C:\\Users\\janic\\Downloads\\pretty-creative-resume-template-burgundy.pdf";

const SAMPLE_JD = `Senior Product Designer
Responsibilities:
- Lead UI/UX design initiatives for web and mobile products.
- Collaborate with product managers and engineers to deliver high-quality design systems.
- Conduct user research, wireframing, and interactive prototyping using Figma.
- Analyze product metrics and improve user conversion rates.
Requirements:
- 4+ years experience in product design, visual layout, and typography.
- Proficiency in Figma, Design Systems, and user testing.
- Proven portfolio demonstrating creative design thinking and measurable impact.`;

async function main() {
  console.log("=== SUCCESS PRO E2E VERIFICATION ===");
  console.log("Testing file:", PDF_PATH);

  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`Resume file not found at ${PDF_PATH}`);
  }

  const rawBytes = fs.readFileSync(PDF_PATH);
  const uniqueBuffer = Buffer.concat([rawBytes, Buffer.from(`\n% ${Date.now()}`)]);
  console.log("File size:", uniqueBuffer.length, "bytes");

  // Step 1: Upload resume to /api/resumes
  console.log("\n[1] Uploading resume to /api/resumes...");
  const blob = new Blob([uniqueBuffer], { type: "application/pdf" });
  const form = new FormData();
  form.append("resume", blob, `live-resume-${Date.now()}.pdf`);

  const uploadRes = await fetch(`${BASE_URL}/api/resumes`, {
    method: "POST",
    body: form,
  });

  console.log("Upload HTTP status:", uploadRes.status);
  const uploadJson = await uploadRes.json();
  console.log("Upload response:", JSON.stringify(uploadJson, null, 2));

  if (uploadRes.status !== 202 || !uploadJson.processingJobId) {
    throw new Error(`Upload failed or did not return 202: ${JSON.stringify(uploadJson)}`);
  }

  const jobId = uploadJson.processingJobId;
  console.log("Job ID enqueued:", jobId);

  // Step 2: Poll native job endpoint
  console.log("\n[2] Polling worker progress for Job:", jobId);
  let completedJob = null;
  const pollStart = Date.now();

  while (Date.now() - pollStart < 120_000) {
    const statusRes = await fetch(`${BASE_URL}/api/resumes/native/${encodeURIComponent(jobId)}`);
    const statusJson = await statusRes.json();
    console.log(`[${Math.round((Date.now() - pollStart)/1000)}s] Status: ${statusJson.status}`);

    if (["awaiting_review", "completed"].includes(statusJson.status)) {
      completedJob = statusJson;
      break;
    }
    if (["failed", "dead_letter", "cancelled"].includes(statusJson.status)) {
      throw new Error(`Worker failed job: ${JSON.stringify(statusJson)}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!completedJob) {
    throw new Error("Worker processing timed out after 120 seconds");
  }

  console.log("\nWorker processing succeeded!");
  const extraction = completedJob.extraction || {};
  console.log("- Page count:", extraction.signals?.pageCount);
  console.log("- Extracted text length:", extraction.text?.length);
  console.log("- Visual evidence present:", extraction.signals?.hasVisualEvidence);
  console.log("- Gemini visual score from worker:", extraction.signals?.geminiVisualScore);

  // Step 3: Run comprehensive review via /api/reviews
  console.log("\n[3] Calling /api/reviews with extracted text, visual signals, and Job Description...");
  const reviewPayload = {
    text: extraction.text,
    targetKeywords: ["Product Design", "Figma", "UI/UX", "Typography"],
    jobDescription: SAMPLE_JD,
    documentSignals: extraction.signals,
    processingJobId: jobId,
  };

  const reviewStart = Date.now();
  const reviewRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewPayload),
  });

  console.log(`[${Math.round((Date.now() - reviewStart)/1000)}s] Review HTTP status:`, reviewRes.status);
  const reviewJson = await reviewRes.json();

  if (reviewRes.status !== 200 || !reviewJson.result) {
    console.error("Review error response:", JSON.stringify(reviewJson, null, 2));
    throw new Error(`Review failed with status ${reviewRes.status}: ${reviewJson.error || "Unknown"}`);
  }

  console.log("\n[4] Review succeeded! Scoring breakdown:");
  const v2 = reviewJson.result.v2;
  console.log("Analysis ID:", reviewJson.analysisId);
  console.log("Cumulative Score:", v2.cumulativeScore, "/", 100);
  console.log("Content Pillar:", `${v2.pillars.content.confirmedEarned.toFixed(1)} / ${v2.pillars.content.fixedMaxPoints}`);
  console.log("Visual Pillar:", `${v2.pillars.visual.confirmedEarned.toFixed(1)} / ${v2.pillars.visual.fixedMaxPoints}`);
  if (v2.pillars.jobMatch) {
    console.log("Job Match Pillar:", `${v2.pillars.jobMatch.confirmedEarned.toFixed(1)} / ${v2.pillars.jobMatch.fixedMaxPoints}`);
  }

  // Step 5: Database verification in successpro_qa
  console.log("\n[5] Verifying persistence in successpro_qa on port 3307...");
  const qaConn = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_qa");
  const [qaJobRows] = await qaConn.query("SELECT id, status, page_count, original_name FROM resume_processing_jobs WHERE id = ?", [jobId]);
  console.log("QA DB Job record:", qaJobRows);

  const [qaAssessRows] = await qaConn.query("SELECT id, processing_job_id, payload, created_at FROM resume_review_assessments WHERE id = ?", [reviewJson.analysisId]);
  console.log("QA DB Assessment record ID:", qaAssessRows[0]?.id);
  console.log("QA DB Assessment persisted score:", qaAssessRows[0]?.payload?.result?.v2?.cumulativeScore ?? qaAssessRows[0]?.payload?.result?.score);
  await qaConn.end();

  // Step 6: Verify refresh persistence
  console.log(`\n[6] Verifying frontend refresh endpoint /api/reviews?analysisId=${reviewJson.analysisId}...`);
  const refreshRes = await fetch(`${BASE_URL}/api/reviews?analysisId=${encodeURIComponent(reviewJson.analysisId)}`);
  console.log("Refresh HTTP status:", refreshRes.status);
  const refreshJson = await refreshRes.json();
  console.log("Persisted Cumulative Score on refresh:", refreshJson.result?.v2?.cumulativeScore);

  if (refreshJson.result?.v2?.cumulativeScore !== v2.cumulativeScore) {
    throw new Error(`Score mismatch on refresh: expected ${v2.cumulativeScore}, got ${refreshJson.result?.v2?.cumulativeScore}`);
  }
  console.log("Score identical after refresh! Persistence verified.");

  // Step 7: Verify baseline preservation of successpro_local
  console.log("\n[7] Verifying 100% preservation of successpro_local...");
  const localConn = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
  const [localJobs] = await localConn.query("SELECT count(*) as count FROM resume_processing_jobs");
  const [localAssess] = await localConn.query("SELECT count(*) as count FROM resume_review_assessments");
  console.log("successpro_local baseline:", localJobs[0].count, "jobs,", localAssess[0].count, "assessments");
  await localConn.end();

  if (localJobs[0].count !== 34 || localAssess[0].count !== 20) {
    throw new Error(`Preservation violation! Expected 34 jobs and 20 assessments, found ${localJobs[0].count} / ${localAssess[0].count}`);
  }
  console.log("Preservation check PASSED: exactly 34 jobs and 20 assessments!");

  console.log("\n=== ALL PHASES PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
