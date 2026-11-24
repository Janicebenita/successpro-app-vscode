import { runAiTask } from "./src/lib/ai/orchestrator";
import { analyzeResume } from "@/lib/successpro-v2-review";
import mysql from "mysql2/promise";

process.env.DEV_BYPASS_AUTH = "true";
process.env.GOOGLE_CLOUD_PROJECT = "successpro-local";
process.env.RESUME_NATIVE_PIPELINE_ENABLED = "true";
process.env.RESUME_AI_PROVIDER = "gemini";
process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";

const db = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_qa");
const [rows] = await db.execute("SELECT payload FROM resume_review_assessments WHERE id = 'pn8aofse03f'");
const p = rows[0].payload;
await db.end();

const text = p.input.text;
const deterministicReview = analyzeResume({
  text,
  jobDescription: "",
  targetKeywords: [],
  documentSignals: p.input.documentSignals || {},
});

console.log("Calling runAiTask for Adeline Palmerston...");
let failures = [];
const res = await runAiTask(
  "analyzeResume",
  {
    resumeText: text,
    deterministicReview,
    targetRole: "Graphics Designer",
    jobDescription: "",
    documentSignals: p.input.documentSignals || {},
    sourcePageRanges: [{ page: 1, start: 0, end: text.length }],
  },
  {
    ownerId: "local-developer",
    sensitivity: "personal",
    disablePersistence: true,
    onValidationFailure: (f) => failures.push(f),
  }
);

console.log("Validation result:", res.meta.validation, "Provider:", res.meta.provider, "Model:", res.meta.model);
if (failures.length) {
  console.log("Failures:", JSON.stringify(failures, null, 2));
}
if (res.meta.validation !== "passed") {
  console.log("Assistant output:", JSON.stringify(res.output, null, 2));
}
