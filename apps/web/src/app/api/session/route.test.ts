import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  getConsent: vi.fn(),
  setUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: mocks.verifyIdToken, createSessionCookie: mocks.createSessionCookie },
  adminDb: { collection: (name: string) => ({ doc: () => ({
    get: name === "registration_consents" ? mocks.getConsent : mocks.getUser,
    set: mocks.setUser,
  }) }) },
}));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/product-telemetry", () => ({ recordProductEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/contact-matching", () => ({ normalizedContactHash: () => "hash" }));

import { POST } from "./route";

const request = () => new Request("https://successpro.xfactor.ltd/api/session", { method: "POST", headers: { Authorization: "Bearer test-token" } });

describe("session registration gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyIdToken.mockResolvedValue({ uid: "member-1", email: "member@example.com", email_verified: true });
    mocks.createSessionCookie.mockResolvedValue("secure-session");
    mocks.getUser.mockResolvedValue({ data: () => ({}) });
    mocks.setUser.mockResolvedValue(undefined);
  });

  it("does not issue a session when registration choices are missing", async () => {
    mocks.getConsent.mockResolvedValue({ data: () => undefined });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "registration_consent_required" });
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
    expect(mocks.setUser).not.toHaveBeenCalled();
  });

  it("issues a session only after the required choices are recorded", async () => {
    mocks.getConsent.mockResolvedValue({ data: () => ({ adultAndTermsAccepted: true, automatedCareerProcessingAccepted: true, externalAiDataUseAccepted: true }) });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("successpro_session=");
    expect(mocks.createSessionCookie).toHaveBeenCalledOnce();
  });

  it("lets a member who withdrew processing sign in to manage the account", async () => {
    mocks.getConsent.mockResolvedValue({ data: () => ({ adultAndTermsAccepted: true, automatedCareerProcessingAccepted: false, withdrawnAt: "2026-09-30" }) });
    mocks.getUser.mockResolvedValue({ data: () => ({ processingConsentStatus: "withdrawn" }) });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ restricted: true });
  });
});
