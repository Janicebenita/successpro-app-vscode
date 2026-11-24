import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

vi.hoisted(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.DEV_BYPASS_AUTH = "true";
  process.env.GOOGLE_CLOUD_PROJECT = "successpro-local";
  process.env.RESUME_NATIVE_PIPELINE_ENABLED = "true";
  process.env.RESUME_AI_PROVIDER = "mock";
  process.env.RESUME_MYSQL_URL = "mysql://successpro:successpro@127.0.0.1:3307/successpro_qa";
  process.env.RESUME_REDIS_URL = "redis://127.0.0.1:6380/15";
  process.env.RESUME_LOCAL_STORAGE_ROOT = "D:/successpro-app-vscode/.local/phase4b/resumes";
  process.env.RESUME_TEMP_ROOT = "D:/successpro-app-vscode/.local/phase4b/resume-temp";
  process.env.RESUME_NATIVE_LOCAL_USER_ID = "local-developer";
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
import { postNativeResume, nativeOwnerId } from "./resume-native/handler";
import { resumeDatabase, resumeQueue, ownedJob } from "./resume-native/infrastructure";
import { POST as postReview, GET as getReview } from "@/app/api/reviews/route";
import { GET as getReport } from "@/app/api/reviews/[id]/report/route";
import mysql from "mysql2/promise";
import { execSync } from "node:child_process";

const FIXTURES_DIR = "D:/successpro-app-vscode/.local/phase4b/fixtures";
const PYTHON_PATH = "D:/successpro-app-vscode/processing/.venv/Scripts/python.exe";
const WORKER_SCRIPT = "D:/successpro-app-vscode/processing/run_worker.py";

describe("Phase 4B Super-Fast Real Application E2E Live Acceptance", () => {
  let candJobsBefore = 0;
  let candAssessBefore = 0;

  beforeAll(async () => {
    // 1. Verify candidate database counts before run
    const candDb = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
    const [jobs] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_processing_jobs");
    const [assess] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_review_assessments");
    candJobsBefore = jobs[0].cnt;
    candAssessBefore = assess[0].cnt;
    await candDb.end();
    console.log(`Candidate DB pre-run baseline: ${candJobsBefore} jobs, ${candAssessBefore} assessments`);

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
    },
    {
      name: "average_twocol_multipage_overlaps",
      file: "average_twocol_multipage_overlaps.pdf",
      withJD: true,
    },
    {
      name: "strong_singlecol_twopage_metrics",
      file: "strong_singlecol_twopage_metrics.pdf",
      withJD: true,
    },
    {
      name: "edge_unsupported_metrics_reversed_dates",
      file: "edge_unsupported_metrics_reversed_dates.pdf",
      withJD: false,
    },
  ];

  for (const tc of testCases) {
    it(
      `executes full end-to-end lifecycle for ${tc.name} (withJD=${tc.withJD})`,
      async () => {
      const filePath = join(FIXTURES_DIR, tc.file);
      expect(existsSync(filePath)).toBe(true);
      const fileBytes = readFileSync(filePath);

      // 1. Create FormData and invoke upload handler
      const formData = new FormData();
      const fileObj = new File([fileBytes], tc.file, { type: "application/pdf" });
      formData.append("resume", fileObj, tc.file);

      const uploadReq = new Request("http://localhost:3000/api/resumes", {
        method: "POST",
        body: formData,
      });

      const uploadRes = await postNativeResume(uploadReq);
      if (uploadRes.status !== 202) {
        console.error("Upload failed with:", uploadRes.status, await uploadRes.text());
      }
      expect(uploadRes.status).toBe(202);
      const uploadJson = await uploadRes.json();
      expect(uploadJson.processingJobId).toBeDefined();
      const jobId = uploadJson.processingJobId;
      console.log(`[${tc.name}] Enqueued job: ${jobId}`);

      // 2. Run python worker until all queued jobs are drained
      const workerCmd = `"${PYTHON_PATH}" -c "import sys; sys.path.insert(0, 'D:/successpro-app-vscode/processing'); from resume_worker.worker import Worker; from resume_worker.config import Settings; w = Worker(Settings.load()); [w.run_once() for _ in range(10)]"`;
      execSync(workerCmd, {
        cwd: "D:/successpro-app-vscode",
        stdio: "inherit",
        env: { ...process.env, PYTHONPATH: "D:/successpro-app-vscode/processing" },
      });

      // 3. Verify job transitioned to awaiting_review in successpro_qa
      const job = await ownedJob(jobId, "local-developer");
      expect(job).not.toBeNull();
      if (job!.status !== "awaiting_review") {
        console.error(`Job ${jobId} failed with status ${job!.status}, error:`, job!.error_message);
      }
      expect(job!.status).toBe("awaiting_review");
      expect(job!.extracted_result).toBeDefined();

      const extracted = typeof job!.extracted_result === "string" ? JSON.parse(job!.extracted_result) : job!.extracted_result;
      expect(extracted.text).toBeDefined();
      expect(extracted.text.length).toBeGreaterThan(50);

      // 4. Submit review to POST /api/reviews
      const jdText = tc.withJD
        ? readFileSync(join(FIXTURES_DIR, "target_job_description.txt"), "utf8")
        : "";

      const reviewReq = new Request("http://localhost:3000/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extracted.text,
          targetJobTitle: tc.withJD ? "Senior Software Engineer" : "",
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
      console.log(`[${tc.name}] Assessment saved: ${analysisId}, Score: ${reviewJson.result.score ?? reviewJson.result.overallScore}`);

      // 5. Verify persistence in successpro_qa
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
    }, 30000);
  }

  it("verifies 100% preservation of candidate database", async () => {
    const candDb = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
    const [jobs] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_processing_jobs");
    const [assess] = await candDb.execute<any[]>("SELECT COUNT(*) as cnt FROM resume_review_assessments");
    await candDb.end();

    expect(jobs[0].cnt).toBe(candJobsBefore);
    expect(assess[0].cnt).toBe(candAssessBefore);
    console.log(`Candidate DB untouched: ${jobs[0].cnt} jobs, ${assess[0].cnt} assessments!`);
  });
});
