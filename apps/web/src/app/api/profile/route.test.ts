// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Reference = { collection: string; id: string };
const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  writes: [] as Array<{ ref: Reference; data: Record<string, unknown> }>,
  transactions: 0,
}));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => ({ uid: "candidate-1" }) }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {
  collection: (collection: string) => ({ doc: (id = `${collection}-new`) => ({ collection, id }) }),
  runTransaction: async (callback: (transaction: {
    get: (ref: Reference) => Promise<{ data: () => Record<string, unknown> | undefined }>;
    set: (ref: Reference, data: Record<string, unknown>) => void;
  }) => Promise<unknown>) => {
    state.transactions += 1;
    return callback({
      get: async (ref) => ({ data: () => state.docs.get(`${ref.collection}/${ref.id}`) }),
      set: (ref, data) => { state.writes.push({ ref, data }); },
    });
  },
} }));
import { PUT } from "./route";

const profile = {
  fullName: "Test Candidate", headline: "Operations leader", location: "Mumbai",
  summary: "Led operations and improved customer delivery.", currentRole: "Operations Manager", industry: "Services",
  skills: ["Operations"], experience: [], education: [], targetRoles: [],
  openToWork: false, publicProfileEnabled: false,
};
const request = (body: unknown) => new Request("http://localhost/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  state.docs.clear(); state.writes = []; state.transactions = 0;
  state.docs.set("resumes/candidate-1", { latestVersionId: "resume-1" });
  state.docs.set("resume_versions/resume-1", { ownerId: "candidate-1", profileDraftWarnings: ["Confirm qualification date."] });
});

describe("confirmed profile and extracted questions", () => {
  it("marks only the current candidate-owned resume version reviewed after a valid save", async () => {
    const response = await PUT(request({ ...profile, reviewAnswers: ["missing-experience", "missing-education", "source-0"], awards: [{ id: "a1", kind: "achievement", title: "Completed a major event", issuer: "", date: "", description: "" }] }));
    expect(response.status).toBe(200);
    expect(state.writes.find(({ ref }) => ref.collection === "resume_versions")?.data).toMatchObject({ profileDraftQuestionsReviewed: true, profileDraftReviewAnswers: ["missing-experience", "missing-education", "source-0"] });
    expect(state.writes.find(({ ref }) => ref.collection === "profiles")?.data).toMatchObject({ ownerId: "candidate-1", version: 1 });
  });

  it("does not silently mark unanswered extraction questions as reviewed", async () => {
    const response = await PUT(request(profile));
    expect(response.status).toBe(409);
    expect((await response.json()).questions).toHaveLength(3);
    expect(state.writes).toHaveLength(0);
  });

  it("does not acknowledge a resume version owned by another account", async () => {
    state.docs.set("resume_versions/resume-1", { ownerId: "someone-else" });
    expect((await PUT(request(profile))).status).toBe(200);
    expect(state.writes.some(({ ref }) => ref.collection === "resume_versions")).toBe(false);
  });

  it("requires the customer to classify legacy highlights before confirming", async () => {
    const response = await PUT(request({ ...profile, awards: [{ id: "a1", title: "Finished a major event", issuer: "", date: "", description: "" }] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/choose whether/i);
    expect(state.transactions).toBe(0);
  });
});
