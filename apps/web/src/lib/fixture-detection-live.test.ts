/** @vitest-environment node */
// Live error-detection check on the planted-defect fixtures through the PRIMARY Gemini path.
// It reports every parameter rating so a person can judge it against the workbook anchors.
// It never forces, targets or rewrites a rating; assertions cover structure only.
// Run only with SUCCESSPRO_LIVE_DETECTION_TEST=1. Optional SUCCESSPRO_DETECTION_FIXTURES=name1,name2.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_PARAMETER_IDS } from "@successpro/domain";

const upload = vi.hoisted(() => ({ job: null as Record<string, unknown> | null }));
vi.hoisted(() => {
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
import { resetAiCircuitBreakersForTests } from "@/lib/ai/orchestrator";
import { adminDb } from "@/lib/firebase-admin";
import { loadReview } from "@/lib/review-storage";

afterEach(() => { upload.job = null; resetAiCircuitBreakersForTests(); });

const allFixtures = [
  { name: "poor_singlecol_nodates_nocontact", withJd: false, planted: "missing dates, missing contact, vague claims, no metrics" },
  { name: "edge_unsupported_metrics_reversed_dates", withJd: true, planted: "unsupported 500% / 1000x metrics, reversed dates Jan 2024 - Dec 2022" },
  { name: "average_twocol_multipage_overlaps", withJd: true, planted: "overlapping employment, unlabelled concurrency, two columns" },
];
const selected = (process.env.SUCCESSPRO_DETECTION_FIXTURES ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const fixtures = selected.length ? allFixtures.filter((fixture) => selected.includes(fixture.name)) : allFixtures;
const live = process.env.SUCCESSPRO_LIVE_DETECTION_TEST === "1";

describe.skipIf(!live)("Live error detection on planted-defect fixtures (primary path)", () => {
  it.each(fixtures)("$name", async ({ name, withJd, planted }) => {
    const root = resolve("../..");
    const pdf = resolve(root, `.local/phase4b/fixtures/${name}.pdf`);
    const jd = withJd ? readFileSync(resolve(root, ".local/phase4b/fixtures/target_job_description.txt"), "utf8").trim() : "";
    const python = resolve(root, "processing/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    expect(existsSync(pdf)).toBe(true);
    expect(process.env.GEMINI_API_KEY).toBeTruthy();

    // Real worker extraction, rendering, OpenCV and Vision with the configured primary (backup only if it fails).
    const extracted = JSON.parse(execFileSync(python, ["-c", [
      "from pathlib import Path",
      "from tempfile import TemporaryDirectory",
      "import json, sys",
      "from resume_worker.config import Settings",
      "from resume_worker.extraction import extract_pdf, document_signals",
      "from resume_worker.worker import analyse_pdf_pages",
      "from resume_worker import ai",
      "settings = Settings.load()",
      "pages, pdf = extract_pdf(Path(sys.argv[1]), settings)",
      "with TemporaryDirectory() as tmp:",
      "    design, images = analyse_pdf_pages(pdf, Path(tmp), settings.render_dpi)",
      "    vision = ai.evaluate_visual_design_with_fallback(images, design, settings)",
      "    meta = vision.get('provider_metadata', {})",
      "    print(json.dumps({'visionModel': vision.get('model'), 'visionFallback': meta.get('fallback'), 'visionValidation': meta.get('validation'), 'visionWarnings': vision.get('warnings', [])}), file=sys.stderr)",
      "    print(json.dumps({'text': '\\n\\n'.join(p.text for p in pages), 'documentSignals': document_signals(pages, design=design, gemini_visual=vision)}))",
    ].join("\n"), pdf], { env: { ...process.env, PYTHONPATH: resolve(root, "processing") }, encoding: "utf8", timeout: 300_000 }));

    const jobId = "22222222-2222-4222-8222-222222222222";
    upload.job = { id: jobId, status: "awaiting_review", original_name: `${name}.pdf`, extracted_result: { text: extracted.text, signals: extracted.documentSignals } };
    await adminDb.collection("entitlements").doc("local-developer").set({ planId: "premium-monthly", activeUntil: { toDate: () => new Date("2099-01-01") } });

    const review = await POST(new Request("http://localhost/api/reviews", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extracted, processingJobId: jobId, jobDescription: jd, targetKeywords: ["Software Engineer"], forceReReview: true }),
    }));
    const body = await review.json();
    const { result, assistant, analysisId, reviewStatus } = body;
    const stored = (await loadReview(analysisId, "local-developer"))?.result;
    const rows = result.v2.parameters as Array<{ id: string; status: string; rating: number | null; originalEarnedPoints?: number; earnedPoints: number; issues?: Array<{ severity: string; message: string }>; naOrPendingReason?: string; evidence?: { excerpt?: string } }>;
    console.info(`DETECTION_REPORT ${name}\n` + JSON.stringify({
      planted, withJd, reviewStatus,
      contentProvider: assistant?.meta?.provider, contentModel: assistant?.meta?.model, contentFallbackDepth: assistant?.meta?.fallbackDepth,
      repairAttempts: assistant?.meta?.repairAttempts, inputTokens: assistant?.meta?.inputTokens, outputTokens: assistant?.meta?.outputTokens,
      rawScore: stored?.rawScore, displayedScore: result.score, scoreStatus: result.v2.scoreStatus,
      pillars: Object.fromEntries(Object.entries(result.v2.pillars).map(([key, value]: [string, any]) => [key, { state: value.state, stored: (stored?.v2?.pillars as any)?.[key]?.confirmedEarned, shown: value.confirmedEarned }])),
      parameters: rows.map((row) => ({ id: row.id, status: row.status, rating: row.rating, severity: row.issues?.map((issue) => issue.severity), reason: row.naOrPendingReason, evidence: row.evidence?.excerpt?.slice(0, 90) })),
      operationalWarnings: result.v2.operationalWarnings, mandatoryGaps: result.v2.mandatoryGaps,
      employmentFindings: result.v2.employmentDateValidation?.findings?.map((finding: any) => `${finding.kind}: ${finding.message}`),
      gapRisk: result.gapRiskAnalysis?.findings?.map((finding: any) => `${finding.severity ?? ""} ${finding.category ?? ""}: ${finding.title ?? finding.message ?? ""}`),
    }, null, 2));

    // Structure only: rows, single -20 adjustment, reload and PDF. Ratings are reported, not asserted.
    expect(review.status).toBe(200);
    expect(rows.map((row) => row.id).sort()).toEqual([...ALL_PARAMETER_IDS].sort());
    if (result.v2.scoreStatus === "completed") {
      expect(result.score).toBeCloseTo(Math.max(0, (stored?.rawScore as number) - 20));
      expect(rows.reduce((sum, row) => sum + row.earnedPoints, 0)).toBeCloseTo(result.score);
    }
    const refresh = await GET(new Request("http://localhost/api/reviews?analysisId=" + analysisId));
    const refreshed = await refresh.json();
    expect(refreshed.result.score).toBe(result.score);
    if (result.v2.scoreStatus !== "completed") expect(result.v2.pillars.visual.confirmedEarned).toBe(stored?.v2?.pillars.visual.confirmedEarned);
    const userFacing = JSON.stringify({ post: body, refresh: refreshed });
    for (const key of ["rawScore", "originalScore", "originalConfirmedEarned", "originalEarnedPoints", "scoreReductionAmount", "scoreReductionFactor", "scoreAdjustmentStatus"]) expect(userFacing, key).not.toContain(`"${key}"`);
    expect(userFacing).not.toMatch(/\b20[- ]?marks?\b|score adjustment|adjusted score|score reduction|raw score/i);

    const report = await getReport(new Request("http://localhost/api/reviews/" + analysisId + "/report"), { params: Promise.resolve({ id: analysisId }) });
    expect(report.status).toBe(200);
    expect(Buffer.from(await report.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  }, 600_000);
});
