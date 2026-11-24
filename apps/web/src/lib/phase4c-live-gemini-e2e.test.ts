import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { execSync } from "node:child_process";

vi.hoisted(() => {
  const fs = require("node:fs");
  const envPath = "D:/successpro-app-vscode/apps/web/.env.local";
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }

  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.DEV_BYPASS_AUTH = "true";
  process.env.GOOGLE_CLOUD_PROJECT = "successpro-local";
  process.env.RESUME_NATIVE_PIPELINE_ENABLED = "true";
  process.env.RESUME_AI_PROVIDER = "gemini";
  process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  process.env.RESUME_MYSQL_URL = "mysql://successpro:successpro@127.0.0.1:3307/successpro_qa";
  process.env.RESUME_REDIS_URL = "redis://127.0.0.1:6380/15";
  process.env.RESUME_LOCAL_STORAGE_ROOT = "D:/successpro-app-vscode/.local/phase4b/resumes";
  process.env.RESUME_TEMP_ROOT = "D:/successpro-app-vscode/.local/phase4b/resume-temp";
  process.env.RESUME_NATIVE_LOCAL_USER_ID = "local-developer";
  process.chdir("D:/successpro-app-vscode/apps/web");
});

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getSessionUser: vi.fn().mockResolvedValue({
      uid: "local-developer",
      email: "demo@successpro.local",
    }),
  };
});

import { postNativeResume } from "./resume-native/handler";
import { resumeQueue, ownedJob } from "./resume-native/infrastructure";
import { POST as postReview, GET as getReview } from "@/app/api/reviews/route";
import { GET as getReport } from "@/app/api/reviews/[id]/report/route";

const FIXTURES_DIR = "D:/successpro-app-vscode/.local/phase4b/fixtures";
const PYTHON_PATH = "D:/successpro-app-vscode/processing/.venv/Scripts/python.exe";

describe("Phase 4C Live Gemini Assessment Acceptance", () => {
  let candJobsBefore = 0;
  let candAssessBefore = 0;
  const executionEvidence: Record<string, any> = {};

  beforeAll(async () => {
    // 1. Verify candidate database baseline
    const candDb = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
    const [jobs] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_processing_jobs");
    const [assess] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_review_assessments");
    candJobsBefore = jobs[0].cnt;
    candAssessBefore = assess[0].cnt;
    await candDb.end();
    console.log(`Candidate DB untouched pre-run baseline: ${candJobsBefore} jobs, ${candAssessBefore} assessments`);

    // Clean isolated QA tables and Redis DB 15
    const qaDb = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_qa");
    await qaDb.execute("TRUNCATE TABLE resume_processing_jobs");
    await qaDb.execute("TRUNCATE TABLE resume_review_assessments");
    await qaDb.end();

    const q = await resumeQueue();
    await q.flushDb();
  });

  const testCases = [
    {
      name: "poor_singlecol_nodates_nocontact",
      file: "poor_singlecol_nodates_nocontact.pdf",
      withJD: false,
      role: "Software Engineer",
    },
    {
      name: "average_twocol_multipage_overlaps",
      file: "average_twocol_multipage_overlaps.pdf",
      withJD: true,
      role: "Senior Full Stack Engineer",
    },
    {
      name: "strong_singlecol_twopage_metrics",
      file: "strong_singlecol_twopage_metrics.pdf",
      withJD: true,
      role: "Staff Software Engineer",
    },
  ];

  for (const tc of testCases) {
    it(
      `executes complete live Gemini workflow for ${tc.name} (withJD=${tc.withJD})`,
      async () => {
        const filePath = join(FIXTURES_DIR, tc.file);
        expect(existsSync(filePath)).toBe(true);
        const fileBytes = readFileSync(filePath);

        // 1. Upload resume through Resume Checker
        const formData = new FormData();
        const fileObj = new File([fileBytes], tc.file, { type: "application/pdf" });
        formData.append("resume", fileObj, tc.file);

        const uploadReq = new Request("http://localhost:3000/api/resumes", {
          method: "POST",
          body: formData,
        });

        const uploadRes = await postNativeResume(uploadReq);
        expect(uploadRes.status).toBe(202);
        const uploadJson = await uploadRes.json();
        expect(uploadJson.processingJobId).toBeDefined();
        const jobId = uploadJson.processingJobId;
        console.log(`[${tc.name}] Uploaded and enqueued: job ${jobId}`);

        // 2. Run Python Worker (extracts text and calls Gemini Vision for visual design)
        const workerCmd = `"${PYTHON_PATH}" -c "import sys; sys.path.insert(0, 'D:/successpro-app-vscode/processing'); from resume_worker.worker import Worker; from resume_worker.config import Settings; w = Worker(Settings.load()); [w.run_once() for _ in range(5)]"`;
        execSync(workerCmd, {
          cwd: "D:/successpro-app-vscode",
          stdio: "inherit",
          env: { ...process.env, PYTHONPATH: "D:/successpro-app-vscode/processing", RESUME_AI_PROVIDER: "gemini" },
        });

        // 3. Verify worker claim & extraction in QA database
        const job = await ownedJob(jobId, "local-developer");
        expect(job).not.toBeNull();
        expect(job!.status).toBe("awaiting_review");
        expect(job!.extracted_result).toBeDefined();

        const extracted = typeof job!.extracted_result === "string" ? JSON.parse(job!.extracted_result) : job!.extracted_result;
        expect(extracted.text).toBeDefined();
        expect(extracted.text.length).toBeGreaterThan(50);

        // 4. Submit review to POST /api/reviews (calls live Gemini analyzeResume)
        const jdText = tc.withJD
          ? readFileSync(join(FIXTURES_DIR, "target_job_description.txt"), "utf8")
          : "";

        const reviewReq = new Request("http://localhost:3000/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: extracted.text,
            targetJobTitle: tc.role,
            jobDescription: jdText,
            processingJobId: jobId,
          }),
        });

        const reviewRes = await postReview(reviewReq);
        expect(reviewRes.status).toBe(200);
        const reviewJson = await reviewRes.json();
        expect(reviewJson.analysisId).toBeDefined();
        expect(reviewJson.result).toBeDefined();
        const analysisId = reviewJson.analysisId;

        // Verify genuine Gemini assessment (NOT fallback, NOT mock)
        const assistant = reviewJson.assistant;
        expect(assistant).toBeDefined();
        expect(assistant.meta).toBeDefined();
        expect(assistant.meta.validation).toBe("passed");
        expect(assistant.meta.provider).toMatch(/gemini/i);
        expect(assistant.meta.provider).not.toBe("successpro-rules");
        expect(assistant.meta.provider).not.toBe("mock");

        const score = reviewJson.result.score ?? reviewJson.result.overallScore;
        console.log(`[${tc.name}] Assessment PASSED! AnalysisId: ${analysisId}, Score: ${score}, Provider: ${assistant.meta.provider}, Model: ${assistant.meta.model}`);

        // 5. Verify database persistence in successpro_qa
        const qaDb = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_qa");
        const [saved] = await qaDb.execute<any[]>(
          "SELECT id, payload FROM resume_review_assessments WHERE id = ?",
          [analysisId]
        );
        expect(saved.length).toBe(1);
        await qaDb.end();

        // 6. Verify dashboard refresh (GET /api/reviews?analysisId=...)
        const getReq = new Request(`http://localhost:3000/api/reviews?analysisId=${analysisId}`, {
          method: "GET",
        });
        const getRes = await getReview(getReq);
        expect(getRes.status).toBe(200);
        const getJson = await getRes.json();
        expect(getJson.analysisId).toBe(analysisId);
        expect(getJson.result).toBeDefined();
        expect(getJson.assistant?.meta.validation).toBe("passed");

        // 7. Verify PDF report export (GET /api/reviews/[id]/report)
        const reportReq = new Request(`http://localhost:3000/api/reviews/${analysisId}/report`, {
          method: "GET",
        });
        const reportRes = await getReport(reportReq, { params: Promise.resolve({ id: analysisId }) });
        expect(reportRes.status).toBe(200);
        expect(reportRes.headers.get("content-type")).toBe("application/pdf");
        const pdfBytes = new Uint8Array(await reportRes.arrayBuffer());
        expect(pdfBytes.length).toBeGreaterThan(5000);
        const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf8");
        expect(header).toBe("%PDF-");
        console.log(`[${tc.name}] PDF generated: ${pdfBytes.length} bytes`);

        // Record evidence for report
        executionEvidence[tc.name] = {
          jobId,
          analysisId,
          score,
          provider: assistant.meta.provider,
          model: assistant.meta.model,
          latencyMs: assistant.meta.latencyMs,
          validation: assistant.meta.validation,
          repairAttempts: assistant.meta.repairAttempts,
          pdfBytes: pdfBytes.length,
          topActionsCount: assistant.output.topActions?.length ?? 0,
          criteriaCount: assistant.output.workbookAssessments?.length ?? 0,
          summary: assistant.output.summary,
        };
      },
      300000
    );
  }

  it("verifies 100% preservation of candidate database", async () => {
    const candDb = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
    const [jobs] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_processing_jobs");
    const [assess] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_review_assessments");
    await candDb.end();

    expect(jobs[0].cnt).toBe(candJobsBefore);
    expect(assess[0].cnt).toBe(candAssessBefore);
    console.log(`Candidate DB untouched: ${jobs[0].cnt} jobs, ${assess[0].cnt} assessments!`);

    // Write evidence file for report generation
    writeFileSync(
      "D:/successpro-app-vscode/.local/phase4b/phase4c_evidence.json",
      JSON.stringify(executionEvidence, null, 2),
      "utf8"
    );
  });
});
