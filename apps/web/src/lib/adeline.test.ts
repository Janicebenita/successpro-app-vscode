import { describe, it, expect, vi } from "vitest";

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
  process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
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

import { runAiTask } from "./ai/orchestrator";
import { analyzeResume } from "@successpro/domain";
import mysql from "mysql2/promise";

describe("Adeline Palmerston diagnostic", () => {
  it("runs analyzeResume on Adeline resume", async () => {
    const db = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_qa");
    const [rows] = await db.execute<any[]>("SELECT payload FROM resume_review_assessments WHERE id = 'pn8aofse03f'");
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
    let failures: any[] = [];
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
    expect(res.meta.validation).toBe("passed");
  }, 120000);
});
