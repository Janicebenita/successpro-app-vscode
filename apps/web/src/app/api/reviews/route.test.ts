// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  used: 0, nextId: 0, exempt: false, consent: true, trusted: true,
  writes: [] as Array<{ collection: string; data: Record<string, unknown> }>,
  generate: vi.fn(), notify: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => ({ uid: "test-user" }) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/testing-exemptions", () => ({ hasResumeReviewTestExemption: () => state.exempt }));
vi.mock("@/lib/feature-entitlements", () => ({ resolveUserEntitlements: async () => ({ planId: "free", entitlements: { atsReviewsPerMonth: 3 } }) }));
vi.mock("@/lib/ai/orchestrator", () => ({ runAiTask: state.generate, isReusableAiCache: () => false }));
vi.mock("@/lib/notifications", () => ({ createNotification: state.notify }));
vi.mock("@/lib/product-telemetry", () => ({ recordProductEvent: async () => undefined }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {
  collection: (collection: string) => ({ doc: (id = `analysis-${++state.nextId}`) => ({ collection, id, get: async () => ({ data: () => collection === "usage_allowances" ? { completed: state.used } : collection === "registration_consents" ? { externalAiDataUseAccepted: state.consent } : {} }) }) }),
  runTransaction: state.transaction,
} }));
vi.mock("@/lib/resume-native/handler", () => ({ nativeOwnerId: async () => "test-user" }));
vi.mock("@/lib/resume-native/infrastructure", () => ({ ownedJob: async () => state.trusted ? {id:"11111111-1111-4111-8111-111111111111",status:"completed",extracted_result:{text:resumeText,signals:{extractionReliable:true,hasVisualEvidence:true,pageCount:1,geminiPageFindings:[{page:1,confidence:.9,observations:[],warnings:[]}],geminiVisualCriteria:["V01","V02","V03","V04","V05","V06"].map(code => ({code,rating:4,confidence:.9,pages:[1],evidence:"Verified page evidence",recommendation:"Visible minor shortfall", anchorText: "Strong evidence with a limited shortfall", anchorJustification: "Rendered headings are visible with minor spacing issues.", nextAnchorGap: "Keep heading spacing uniform."}))}}} : null, parseStoredJson:(v:unknown) => v }));
import { POST } from "./route";
const resumeText = "Product manager with experience leading customer operations. Improved service processes and coordinated cross-functional product teams.";

const request = () => new Request("http://localhost/api/reviews", { method: "POST", body: JSON.stringify({ text: resumeText, processingJobId:"11111111-1111-4111-8111-111111111111", targetKeywords: [], documentSignals: {} }) });
const success = () => ({ output: { summary: "Grounded review", workbookAssessments:["C01","C02","C03","C04","C05","C06","C07","C08","C09"].map(id => ({id,status:"Assessed",rating:4,evidence:{excerpt:"Product manager",rationale:"Evidence shortfall"}})), topActions: [], limitations: [] }, meta: { validation: "passed" } });

beforeEach(() => {
  vi.clearAllMocks();
  state.trusted = true; state.used = 0; state.nextId = 0; state.exempt = false; state.consent = true; state.writes = [];
  state.generate.mockResolvedValue(success()); state.notify.mockResolvedValue(undefined);
  state.transaction.mockImplementation(async (callback) => {
    const writes: typeof state.writes = [];
    const value = await callback({ get: async () => ({ data: () => ({ completed: state.used }) }), set: (ref: { collection: string }, data: Record<string, unknown>) => writes.push({ collection: ref.collection, data }) });
    state.writes.push(...writes);
    const allowance = writes.find((write) => write.collection === "usage_allowances");
    if (allowance) state.used = allowance.data.completed as number;
    return value;
  });
});

describe("completed-review allowance", () => {
  it("rejects a legacy OCR status message before spending a provider call", async () => {
    const response = await POST(new Request("http://localhost/api/reviews", { method: "POST", body: JSON.stringify({ text: "[Scanned / Image Resume] Visual page detected. (To enable live Gemini Vision OCR, set GEMINI_API_KEY in apps/web/.env.local).", targetKeywords: [] }) }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "RESUME_TEXT_UNAVAILABLE", allowanceUsed: 0 });
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it("charges only after validated AI and all workbook assessments complete, atomically with its saved report", async () => {
    state.generate.mockImplementation(async () => { expect(state.writes).toEqual([]); return success(); });
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ allowanceUsed: 1, remaining: 2, reviewStatus: "completed" });
    expect(state.used).toBe(1);
    expect(state.writes.find((write) => write.collection === "analyses")?.data).toMatchObject({ assistant: success(), status: "completed" });
  });
  it("keeps incomplete workbook results Pending without charging or notifying", async () => {
    state.trusted = false;
    const payload = await (await POST(request())).json();
    expect(payload).toMatchObject({allowanceUsed:0,reviewStatus:"partial",result:{rubricVersion:"successpro-v2",score:null,v2:{scoreStatus:"score_pending",unresolvedMaximumPoints:35}}});
    expect(payload.result.v2).not.toHaveProperty("paidReport");
    expect(payload.assistant).toBeNull();
    expect(state.notify).not.toHaveBeenCalled();
    expect(state.writes.find(w => w.collection === "analyses")?.data.result).toMatchObject({score:null,v2:{mode:"no_job_description"}});
  });
  it("saves a partial report with verified visual rows when all providers fail", async () => {
    state.generate.mockResolvedValue({ ...success(), meta: { validation: "fallback" } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ allowanceUsed: 0, reviewStatus: "partial", assistant: null, result: { score: null, v2: { scoreStatus: "score_pending" } } });
    expect(payload.result.v2.parameters).toHaveLength(20);
    expect(payload.result.v2.pillars).toMatchObject({ content: { state: "Pending" }, visual: { state: "Assessed" }, jobMatch: { state: "Excluded" } });
    expect(state.used).toBe(0);
    expect(state.writes.find(w => w.collection === "analyses")?.data).toMatchObject({ status: "partial", assistant: null, completedAt: null });
    expect(state.notify).not.toHaveBeenCalled();
  });
  it("keeps required job criteria pending when generation throws", async () => {
    state.generate.mockRejectedValue(new Error("provider unavailable"));
    const body = await request().json();
    const response = await POST(new Request("http://localhost/api/reviews", { method: "POST", body: JSON.stringify({
      ...body, jobDescription: "Lead customer operations and coordinate cross-functional projects. Improve service delivery and monitor outcomes.",
    }) }));
    expect(await response.json()).toMatchObject({ allowanceUsed: 0, reviewStatus: "partial", result: {
      score: null, v2: { mode: "with_job_description", pillars: { jobMatch: { state: "Pending" } } },
    } });
    expect(state.used).toBe(0);
  });
  it("rechecks the last slot after generation to prevent a concurrent overspend", async () => {
    state.used = 2;
    state.generate.mockImplementation(async () => { state.used = 3; return success(); });
    expect((await POST(request())).status).toBe(429);
    expect(state.writes).toEqual([]);
    expect(state.used).toBe(3);
  });
  it("rejects exhausted allowance before spending a provider call", async () => {
    state.used = 3;
    expect((await POST(request())).status).toBe(429);
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("keeps the explicit testing exemption without charging", async () => {
    state.exempt = true; state.used = 3;
    expect(await (await POST(request())).json()).toMatchObject({ allowanceUsed: 0, remaining: null, testingExempt: true });
    expect(state.used).toBe(3);
  });
  it("rejects malformed JSON without generating or charging", async () => {
    expect((await POST(new Request("http://localhost/api/reviews", { method: "POST", body: "{" }))).status).toBe(400);
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it("requires consent before generating or charging", async () => {
    state.consent = false;
    expect((await POST(request())).status).toBe(428);
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
});
