import mysql from "mysql2/promise";
import { resumeAnalysisInputSchema } from "@successpro/contracts";

async function main() {
  const conn = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
  const [rows] = await conn.query<any[]>("SELECT id, status, extracted_result FROM resume_processing_jobs ORDER BY created_at DESC LIMIT 3");
  for (const r of rows) {
    console.log("Job ID:", r.id, "Status:", r.status);
    if (r.extracted_result) {
      const ext = typeof r.extracted_result === "string" ? JSON.parse(r.extracted_result) : r.extracted_result;
      console.log("Extracted keys:", Object.keys(ext));
      console.log("Extracted signals:", ext.signals);
      const parsed = resumeAnalysisInputSchema.safeParse({
        text: ext.text || "Sample resume text at least 80 chars long to pass validation and testing requirements.",
        documentSignals: ext.signals,
      });
      console.log("SafeParse success:", parsed.success);
      if (!parsed.success) {
        console.log("SafeParse errors:", parsed.error.issues);
      } else {
        console.log("Parsed signals:", parsed.data.documentSignals);
      }
    }
  }
  await conn.end();
}

main().catch(console.error);
