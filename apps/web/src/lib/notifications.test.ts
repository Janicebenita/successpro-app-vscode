import { describe, expect, it } from "vitest";
import { mandatoryNotificationCategories, normalizeNotificationPreferences, paymentNotification } from "./notifications";
describe("notification preferences", () => { it("allows optional categories to be muted but always preserves account-critical notices", () => { const result = normalizeNotificationPreferences({ messages: false, jobs: false, payments: false, privacy: false, security: false }); expect(result.messages).toBe(false); expect(result.jobs).toBe(false); for (const category of mandatoryNotificationCategories) expect(result[category]).toBe(true); }); });

describe("payment notifications", () => {
  it("distinguishes confirmed, failed, and processing states without claiming an uncertain charge", () => {
    expect(paymentNotification("payment.captured").title).toBe("Payment confirmed");
    expect(paymentNotification("payment.failed").message).toContain("No successful charge");
    expect(paymentNotification("payment.authorized").title).toBe("Payment update");
  });
});
