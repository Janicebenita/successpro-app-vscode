// @vitest-environment node
import { describe, it, vi } from "vitest";
import fs from "node:fs";

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
        process.env[k] = v;
      }
    }
  }
  process.env.DEV_BYPASS_AUTH = "true";
  process.env.GOOGLE_CLOUD_PROJECT = "successpro-local";
  process.env.RESUME_AI_PROVIDER = "gemini";
  process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
});

import { runAiTask } from "./ai/orchestrator";
import { analyzeResume } from "@successpro/domain";

describe("live gemini assessment diagnostic with JD", () => {
  it("diagnoses why Gemini analyzeResume returns fallback when JD is provided", async () => {
    const resumeText = "Experienced Software Engineer with 6 years in full-stack web development. Proficient in TypeScript, React, Node.js, and PostgreSQL. Led engineering projects delivering 35% performance improvement across cloud platforms. Managed team of 4 engineers and improved delivery timelines by 20%. Bachelor of Science in Computer Science from University of Technology, 2018. Top 100 Finalist - Google AI Agent Builder Series 2026.";

    const jdText = `Job Title: Senior Content Creator & Strategist
Experience with AI-assisted content creation tools is an added advantage.
### Key Competencies
- Creative Thinking
- Audience Engagement
- Brand Awareness
- Storytelling
- Adaptability
- Collaboration
- Attention to Detail
Requirements: 3+ years experience in content strategy and digital publishing.`;

    const deterministicReview = analyzeResume({
      text: resumeText,
      targetKeywords: ["Software Engineer"],
      jobDescription: jdText,
      documentSignals: { pageCount: 1 }
    });

    console.log("=== RUNNING LIVE AI TASK WITH JD ===");
    const res = await runAiTask(
      "analyzeResume",
      {
        resumeText,
        deterministicReview,
        targetRole: "Content Creator",
        jobDescription: jdText,
        documentSignals: { pageCount: 1 },
        sourcePageRanges: []
      },
      {
        ownerId: "local-developer",
        sensitivity: "personal",
        preferredLanguage: "en",
        disablePersistence: true,
        onValidationFailure: (event) => {
          console.error("ON_VALIDATION_FAILURE:", JSON.stringify(event));
        }
      }
    );

    console.log("=== RUN RESULT WITH JD ===");
    console.log("META:", JSON.stringify(res.meta));
    console.log("VALIDATION:", res.meta.validation);
    console.log("PROVIDER:", res.meta.provider);
    if (res.meta.validation !== "passed") {
      console.log("OUTPUT:", JSON.stringify(res.output));
    }
  }, 120_000);
});
