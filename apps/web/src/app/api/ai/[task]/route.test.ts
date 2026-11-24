// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  generate: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => ({ uid: "member-1" }) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => state.profile }) }) }) } }));
vi.mock("@/lib/ai/orchestrator", () => ({ runAiTask: state.generate }));
import { POST } from "./route";

const savedProfile = {
  fullName: "Confirmed Candidate", headline: "Operations Director", location: "Mumbai", summary: "Led operations.", currentRole: "Operations Director", industry: "Logistics",
  skills: ["Operations"], experience: [], education: [], targetRoles: ["Director"],
};

beforeEach(() => { state.profile = savedProfile; state.generate.mockReset().mockResolvedValue({ output: { subject: "Draft" }, meta: { validation: "passed" } }); });

describe("customer-selected AI writing", () => {
  it.each(["generateCoverLetter", "generateLinkedInMakeover"])("uses the saved profile for %s rather than browser-supplied identity", async (task) => {
    const request = new Request(`http://localhost/api/ai/${task}`, { method: "POST", body: JSON.stringify({ profile: { fullName: "Other Person" }, targetRole: "Director", company: "Example" }) });
    const response = await POST(request, { params: Promise.resolve({ task }) });
    expect(response.status).toBe(200);
    expect(state.generate).toHaveBeenCalledWith(task, expect.objectContaining({ profile: expect.objectContaining({ fullName: "Confirmed Candidate" }) }), expect.anything());
  });
  it("does not generate from a missing saved profile", async () => {
    state.profile = {};
    const request = new Request("http://localhost/api/ai/generateCoverLetter", { method: "POST", body: JSON.stringify({ profile: savedProfile, targetRole: "Director", company: "Example" }) });
    const response = await POST(request, { params: Promise.resolve({ task: "generateCoverLetter" }) });
    expect(response.status).toBe(409);
    expect(state.generate).not.toHaveBeenCalled();
  });
});
