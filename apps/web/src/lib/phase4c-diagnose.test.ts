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

describe("Phase 4C Gemini Content Validation Diagnosis", () => {
  it("diagnoses Gemini live analysis on poor_singlecol_nodates_nocontact", async () => {
    const text = `JOHN DOE
San Francisco, CA | 555-0199 | john.doe@example.com

SUMMARY
Software engineer with experience building web applications.

EXPERIENCE
Software Engineer | Acme Corp
Built features for customer dashboard using React and Node.js.
Collaborated with product team on specifications.
Fixed bugs and improved performance.

Junior Developer | Beta Solutions
Maintained legacy codebase.
Assisted with database migrations.

EDUCATION
BS Computer Science | State University

SKILLS
JavaScript, TypeScript, React, Node.js, Git, HTML, CSS`;

    const inputData = {
      text,
      targetJobTitle: "Software Engineer",
      targetKeywords: ["Software Engineer"],
      jobDescription: "",
      documentSignals: {},
    };

    const deterministicReview = analyzeResume(inputData);

    let caughtFailures: any[] = [];

    const res = await runAiTask(
      "analyzeResume",
      {
        resumeText: text,
        deterministicReview,
        targetRole: "Software Engineer",
        jobDescription: "",
        documentSignals: {},
        sourcePageRanges: [{ page: 1, start: 0, end: text.length }],
      },
      {
        ownerId: "local-developer",
        sensitivity: "personal",
        disablePersistence: true,
        onValidationFailure: (failure) => {
          caughtFailures.push(failure);
        },
      }
    );

    console.log("=== RUN_META ===", JSON.stringify(res.meta, null, 2));

    if (caughtFailures.length > 0) {
      console.log("=== ALL VALIDATION ISSUES CAUGHT ===");
      for (const f of caughtFailures) {
        console.log(`Stage: ${f.stage}, Provider: ${f.provider}`);
        for (const iss of f.issues) {
          console.log(` - [${iss.code}] ${iss.path}: ${iss.message}`);
        }
      }
    }

    expect(res.meta.validation).toBe("passed");
  }, 150000);
});
