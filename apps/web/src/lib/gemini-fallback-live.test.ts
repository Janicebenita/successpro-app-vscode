
/** @vitest-environment node */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GoogleAuth } from "google-auth-library";
import { reviewEvidence } from "@/lib/ai/review-evidence";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { ALL_PARAMETER_IDS, CONTENT_PARAMETER_IDS, JOB_MATCH_PARAMETER_IDS, VISUAL_PARAMETER_IDS, PARAMETER_REGISTRY, RATING_RUBRIC } from "@successpro/domain";

const upload = vi.hoisted(() => ({ job: null as Record<string, unknown> | null }));
vi.hoisted(() => {
  delete process.env.RESUME_CONTENT_VERTEX_PROJECT;
  process.env.DEV_BYPASS_AUTH = "true";
  process.env.GOOGLE_CLOUD_PROJECT = "successpro-local";
  process.env.RESUME_NATIVE_PIPELINE_ENABLED = "false";
});
vi.mock("@/lib/session", () => ({
  getSessionUser: async () => ({ uid: "local-developer", email: "demo@successpro.local" }),
}));

vi.mock("@/lib/resume-native/infrastructure", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/resume-native/infrastructure")>(),
  ownedJob: async () => upload.job,
}));

import { POST, GET } from "@/app/api/reviews/route";
import { GET as getReport } from "@/app/api/reviews/[id]/report/route";
import { loadAiConfig } from "@/lib/ai/config";
import { resetAiCircuitBreakersForTests } from "@/lib/ai/orchestrator";
import { adminDb } from "@/lib/firebase-admin";
import { loadReview } from "@/lib/review-storage";

afterEach(() => {
  upload.job = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetAiCircuitBreakersForTests();
});

describe("Gemini fallback through the Resume Checker", () => {
  const cases = [
    { name: "simulated Gemini response", live: false, vertex: false },
    { name: "simulated Vertex AI response", live: false, vertex: true },
    ...(process.env.SUCCESSPRO_LIVE_FALLBACK_TEST === "1" ? [{ name: "live Gemini response", live: true, vertex: false }] : []),
  ];
  it.each(cases)("validates a $name, scores it once and exports the report", async ({ live, vertex }) => {
    const root = resolve("../..");
    const fixture = resolve(root, ".local/phase4b/fixtures/strong_singlecol_twopage_metrics.pdf");
    const jdFixture = resolve(root, ".local/phase4b/fixtures/target_job_description.txt");
    const python = resolve(root, "processing/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    const usePdf = live || [fixture, jdFixture, python].every(existsSync);
    const jd = usePdf ? readFileSync(jdFixture, "utf8").trim() : [
      "Build and maintain reliable backend services and APIs.",
      "Define and monitor operational metrics for critical services.",
    ].join("\n");
    const extracted = usePdf ? JSON.parse(execFileSync(python, [
      "-c", [
        "from pathlib import Path",
        "from tempfile import TemporaryDirectory",
        "import json, sys",
        "from unittest.mock import patch",
        "from resume_worker.config import Settings",
        "from resume_worker.extraction import extract_pdf, document_signals",
        "from resume_worker.worker import analyse_pdf_pages",
        "from resume_worker import ai",
        "settings = Settings.load()",
        "pages, pdf = extract_pdf(Path(sys.argv[1]), settings)",
        "with TemporaryDirectory() as tmp:",
        "    design, images = analyse_pdf_pages(pdf, Path(tmp), settings.render_dpi)",
        "    vision = None",
        "    if sys.argv[2] == 'live':",
        "        evaluate = ai.evaluate_visual_design_gemini",
        "        def force_primary_failure(pages, metrics, config):",
        "            if config.gemini_model == settings.gemini_model:",
        "                return {'score': None, 'warnings': ['Simulated primary 503']}",
        "            return evaluate(pages, metrics, config)",
        "        with patch.object(ai, 'evaluate_visual_design_gemini', force_primary_failure):",
        "            vision = ai.evaluate_visual_design_with_fallback(images, design, settings)",
        "        if not vision.get('provider_metadata', {}).get('fallback'):",
        "            raise RuntimeError('Live Gemini backup Vision did not complete')",
        "        expected_vision = settings.gemini_vision_fallback_model or settings.gemini_fallback_model",
        "        if vision.get('model') != expected_vision:",
        "            raise RuntimeError('Vision backup used ' + str(vision.get('model')) + ', expected ' + expected_vision)",
        "        print(json.dumps({'visionPrimaryRequested': settings.gemini_model, 'visionBackupModel': vision.get('model'), 'visionScore': vision.get('score'), 'visionPages': len(vision.get('pages', [])), 'visionRatings': {c['code']: c['rating'] for c in vision.get('criteria', [])}}), file=sys.stderr)",
        "    print(json.dumps({'text': '\\n\\n'.join(p.text for p in pages), 'documentSignals': document_signals(pages, design=design, gemini_visual=vision)}))",
      ].join("\n"), fixture, live ? "live" : "simulated",
    ], { env: { ...process.env, PYTHONPATH: resolve(root, "processing") }, encoding: "utf8", timeout: 200_000 })) : {
      text: [
        "Jordan Example",
        "Software engineer building and maintaining reliable backend services.",
        "Built service health dashboards and monitored operational metrics.",
        "Implemented service APIs and worked with support to diagnose incidents.",
      ].join("\n"),
      documentSignals: { extractionReliable: true, pageCount: 1, hasVisualEvidence: true },
    };

    const jobId = "11111111-1111-4111-8111-111111111111";
    if (live) {
      expect(process.env.GEMINI_API_KEY).toBeTruthy();
      expect(extracted.documentSignals.geminiVisualCriteria?.map((row: { code: string }) => row.code).sort()).toEqual([...VISUAL_PARAMETER_IDS].sort());
    } else {
      vi.stubEnv("GEMINI_API_KEY", "test-key");
      const pages = Array.from({ length: extracted.documentSignals.pageCount }, (_, index) => index + 1);
      extracted.documentSignals.geminiPageFindings = pages.map(page => ({ page, confidence: 0.95, observations: [], warnings: [] }));
      extracted.documentSignals.geminiVisualCriteria = VISUAL_PARAMETER_IDS.map(code => ({
        code, rating: 4, confidence: 0.9, pages,
        evidence: "Visible page structure with one minor shortfall.",
        recommendation: "Review the affected rendered page.",
        anchorText: RATING_RUBRIC[code][4],
        anchorJustification: "Visible page structure supports this rating.",
        nextAnchorGap: "Correct the localized shortfall.",
      }));
    }
    upload.job = {
      id: jobId, status: "awaiting_review", original_name: "qa-resume.pdf",
      extracted_result: { text: extracted.text, signals: extracted.documentSignals },
    };
    expect(extracted.text.length).toBeGreaterThan(80);
    expect(extracted.documentSignals.hasVisualEvidence).toBe(true);
    vi.stubEnv("RESUME_AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_MODEL", "successpro-test-primary-unavailable");
    if (vertex) {
      vi.stubEnv("RESUME_CONTENT_VERTEX_PROJECT", "test-staging");
      vi.spyOn(GoogleAuth.prototype, "getRequestHeaders").mockResolvedValue(
        new Headers({ authorization: "Bearer test-only", "x-goog-user-project": "test-staging" }) as Awaited<ReturnType<GoogleAuth["getRequestHeaders"]>>,
      );
    }
    const config = await loadAiConfig("analyzeResume");
    const [primary, fallback] = config.providers;
    expect(fallback?.id).toBe(vertex ? "resume-vertex-fallback" : "local-gemini-fallback");
    await adminDb.collection("entitlements").doc("local-developer").set({ planId: "premium-monthly", activeUntil: { toDate: () => new Date("2099-01-01") } });
    await adminDb.collection("profiles").doc("local-developer").set({ currentRole: "Software Engineer", skills: ["Python"] });

    const excerpt = (extracted.text as string).split("\n").map((line) => line.trim()).find((line) => line.length >= 40 && line.length <= 150)!;
    expect(excerpt).toBeTruthy();
    const evidence = { excerpt, rationale: "The resume contains this documented experience." };
    const requirements = jd.split("\n").map((line) => line.trim()).filter((line) => line.length > 30).slice(0, 2);
    expect(requirements).toHaveLength(2);
    const simulated = aiTaskSchemas.analyzeResume.output.parse({
      analysisVersion: "successpro-v2",
      summary: "The resume includes relevant experience and provides a basis for role alignment.",
      limitations: [],
      topActions: Array.from({ length: 3 }, () => ({
        observed: "The experience is documented.", inference: "", suggestion: "Clarify the scope of the work.",
        originalExcerpt: excerpt,
      })),
      meaningfulJd: true,
      workbookAssessments: [
        ...CONTENT_PARAMETER_IDS.map((id) => ({
          id, status: "Assessed", rating: 3, evidence,
          anchorComparison: {
            anchor: RATING_RUBRIC[id][3], justification: evidence.rationale,
            nextAnchorGap: "Clarify the scope shown by the evidence.", informationState: "present",
          },
        })),
        ...JOB_MATCH_PARAMETER_IDS.map((id) => id === "J01"
          ? { id, status: "Assessed", rating: 3, evidence }
          : { id, status: "N/A", rating: null, naOrPendingReason: "No explicit requirement assigned to this parameter." }),
      ],
      jdRequirements: requirements.map((sourceText, index) => ({
        id: "r" + index, owner: "J01", sourceText, status: "Assessed", rating: 3, evidence, mandatory: false,
      })),
    });

    const spanId = reviewEvidence(extracted.text).find(({ text }) => text === excerpt)?.id;
    if (vertex) {
      expect(spanId).toBeTruthy();
      simulated.workbookAssessments![0].anchorComparison!.anchor = RATING_RUBRIC.C01[3].toLowerCase();
      simulated.jdRequirements![0].evidence.sourceExcerptId = "wrong-id";
      simulated.jdRequirements![1].evidence.sourceExcerptId = spanId;
      simulated.jdRequirements![1].evidence.excerpt = "";
    }
    const unsupported = structuredClone(simulated);
    unsupported.workbookAssessments![0].evidence!.excerpt = "This sentence never appeared in the resume.";

    const realFetch = globalThis.fetch;
    const calls: Array<{ model: string; prompt: string; responseJsonSchema: unknown; status: number }> = [];
    let fallbackResponses = 0;
    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      const model = url.match(/\/models\/([^:]+):generateContent/)?.[1];
      if (!model) return realFetch(input, init);
      if (vertex) {
        expect(url).toContain("https://aiplatform.googleapis.com/v1/projects/test-staging/");
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-only");
      } else {
        expect(url).toContain("https://generativelanguage.googleapis.com/");
      }
      const body = JSON.parse(String(init?.body));
      const response = model === primary.model
        ? Response.json({ error: { message: "Simulated primary failure" } }, { status: 500 })
        : live ? await realFetch(input, init)
          : Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(fallbackResponses++ === 0 ? unsupported : simulated) }] } }] });
      calls.push({ model, prompt: body.contents[0].parts[0].text, responseJsonSchema: body.generationConfig.responseJsonSchema, status: response.status });
      return response;
    });

    const review = await POST(new Request("http://localhost/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extracted, processingJobId: jobId, jobDescription: jd, targetKeywords: ["Software Engineer"], forceReReview: true }),
    }));

    expect(calls[0]).toMatchObject({ model: primary.model, status: 500 });
    expect(calls[1]).toMatchObject({ model: fallback.model });
    expect(calls[1].prompt === calls[0].prompt).toBe(true);
    expect(calls[1].responseJsonSchema).toEqual(calls[0].responseJsonSchema);
    expect(calls[1].responseJsonSchema).toBeDefined();
    const [, dataJson] = calls[1].prompt.match(/<DATA>(.*?)<\/DATA>/s) ?? [];
    const data = JSON.parse(dataJson);
    expect(extracted.text.includes(data.resumeText.split("\n")[0])).toBe(true);
    expect(data.jobDescription).toBe(jd);
    expect(data.profileContext).toMatchObject({ currentRole: "Software Engineer" });
    expect(data.sourceExcerpts.length).toBeGreaterThan(0);
    expect(data.employmentDateValidation).toBeDefined();
    expect(data.documentSignals).toMatchObject({ hasVisualEvidence: true });
    const workbook = calls[1].prompt.split("WORKBOOK REGISTRY (IDs, names, weights, ownership): ")[1].split("\n")[0];
    expect(JSON.parse(workbook)).toEqual(PARAMETER_REGISTRY);
    const anchors = calls[1].prompt.split("WORKBOOK ANCHORS: ")[1];
    expect(anchors.startsWith(JSON.stringify(RATING_RUBRIC))).toBe(true);
    const schema = calls[1].prompt.split("OUTPUT JSON SCHEMA: ")[1].split("\n")[0];
    expect(JSON.parse(schema)).toEqual(z.toJSONSchema(aiTaskSchemas.analyzeResume.output));

    expect(calls.some(({ model, status }) => model === fallback.model && status === 200), "Gemini fallback returned HTTP 200 after any provider retry").toBe(true);
    expect(review.status, JSON.stringify(await review.clone().json())).toBe(200);
    const body = await review.json();
    const { result, assistant, analysisId, reviewStatus } = body;
    const storedRaw = (await loadReview(analysisId, "local-developer"))?.result?.rawScore as number;
    expect(typeof storedRaw).toBe("number");
    expect(reviewStatus).toBe("completed");
    expect(assistant.meta).toMatchObject({ provider: fallback.id, validation: "passed", fallbackDepth: 1 });
    if (!live) {
      expect(assistant.meta.repairAttempts).toBe(1);
      expect(calls[2].prompt).toContain("invalid_source_reference");
    }
    const output = aiTaskSchemas.analyzeResume.output.parse(assistant.output);
    if (vertex) {
      expect(output.workbookAssessments?.find(row => row.id === "C01")?.anchorComparison?.anchor).toBe(RATING_RUBRIC.C01[3]);
      expect(output.jdRequirements?.map(row => row.evidence)).toEqual(
        [0, 1].map(() => expect.objectContaining({ sourceExcerptId: spanId, excerpt })),
      );
    }
    expect(output.workbookAssessments?.map((row) => row.id).sort()).toEqual([...CONTENT_PARAMETER_IDS, ...JOB_MATCH_PARAMETER_IDS].sort());
    for (const row of output.workbookAssessments ?? []) {
      if (row.status === "Assessed" && row.evidence?.excerpt) expect(extracted.text.includes(row.evidence.excerpt)).toBe(true);
    }
    expect(result.v2.parameters.map((row: { id: string }) => row.id).sort()).toEqual([...ALL_PARAMETER_IDS].sort());
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeCloseTo(Math.max(0, storedRaw - 20));
    expect(result.v2.parameters.reduce((sum: number, row: { earnedPoints: number }) => sum + row.earnedPoints, 0)).toBeCloseTo(result.score);
    expect(result.gapRiskAnalysis).toBeDefined();
    console.info("FALLBACK_SUMMARY " + JSON.stringify({
      mode: live ? "live" : "simulated", contentProvider: assistant.meta.provider, contentModel: assistant.meta.model,
      repairAttempts: assistant.meta.repairAttempts, rawScore: storedRaw, displayedScore: result.score,
      ratings: Object.fromEntries(result.v2.parameters.map((row: { id: string; status: string; rating: number | null }) => [row.id, row.status === "Assessed" ? row.rating : row.status])),
    }));
    const refresh = await GET(new Request("http://localhost/api/reviews?analysisId=" + analysisId));
    const refreshed = await refresh.json();
    expect(refreshed.result.score).toBe(result.score);
    const userFacing = JSON.stringify({ post: body, refresh: refreshed });
    for (const key of ["rawScore", "originalScore", "originalConfirmedEarned", "originalEarnedPoints", "scoreReductionAmount", "scoreReductionFactor", "scoreAdjustmentStatus"]) expect(userFacing, key).not.toContain(`"${key}"`);
    expect(userFacing).not.toMatch(/\b20[- ]?marks?\b|score adjustment|adjusted score|score reduction|raw score/i);

    const report = await getReport(new Request("http://localhost/api/reviews/" + analysisId + "/report"), { params: Promise.resolve({ id: analysisId }) });
    expect(report.status).toBe(200);
    expect(report.headers.get("Content-Type")).toBe("application/pdf");
    expect(Buffer.from(await report.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  }, 330_000);
});

