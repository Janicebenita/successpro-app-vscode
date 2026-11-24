import { resumeDatabase } from "./src/lib/resume-native/infrastructure";

async function checkLatestJob() {
  const pool = resumeDatabase();
  const [rows] = await pool.query<any[]>("SELECT id, status, extracted_result, created_at FROM resume_processing_jobs ORDER BY created_at DESC LIMIT 1");
  for (const row of rows) {
    console.log("Job ID:", row.id, "Status:", row.status);
    if (row.extracted_result) {
      const parsed = typeof row.extracted_result === "string" ? JSON.parse(row.extracted_result) : row.extracted_result;
      console.log("Signals:", JSON.stringify(parsed.signals, null, 2));
    }
  }
  process.exit(0);
}

checkLatestJob().catch(console.error);
