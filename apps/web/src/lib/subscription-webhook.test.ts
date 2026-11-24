import { describe, expect, it } from "vitest";
import { extractSubscriptionRef, isStaleSubscriptionEvent } from "./subscription-webhook";

const event = (entity: unknown) => ({ event: "subscription.charged", payload: { subscription: { entity } } });

describe("extractSubscriptionRef", () => {
  it("reads ids, status and paid-until time", () => {
    const ref = extractSubscriptionRef(event({ id: "sub_ABC123", status: "active", current_end: 1_800_000_000, notes: { internal_subscription_id: "AbCdEfGhIjKlMnOpQrSt" } }));
    expect(ref).toEqual({ providerSubscriptionId: "sub_ABC123", internalSubscriptionId: "AbCdEfGhIjKlMnOpQrSt", providerStatus: "active", currentEnd: 1_800_000_000 });
  });

  it("treats an empty notes list as no internal id", () => {
    expect(extractSubscriptionRef(event({ id: "sub_ABC123", notes: [] })).internalSubscriptionId).toBeNull();
  });

  it("rejects a malformed internal id", () => {
    for (const bad of ["x", "has space in it!!", "a/b/c/d/e/f/g/h/i/j/k", 12345, null]) {
      expect(extractSubscriptionRef(event({ id: "sub_ABC123", notes: { internal_subscription_id: bad } })).internalSubscriptionId).toBeNull();
    }
  });

  it("returns empty values for malformed bodies without throwing", () => {
    for (const body of [null, "text", 42, {}, { payload: null }, { payload: { subscription: [] } }]) {
      expect(extractSubscriptionRef(body)).toEqual({ providerSubscriptionId: null, internalSubscriptionId: null, providerStatus: undefined, currentEnd: undefined });
    }
  });
});

describe("isStaleSubscriptionEvent", () => {
  it("flags an older event", () => {
    expect(isStaleSubscriptionEvent(100, 200)).toBe(true);
  });

  it("does not flag newer, equal, missing or invalid times", () => {
    expect(isStaleSubscriptionEvent(300, 200)).toBe(false);
    expect(isStaleSubscriptionEvent(200, 200)).toBe(false);
    expect(isStaleSubscriptionEvent(100, undefined)).toBe(false);
    expect(isStaleSubscriptionEvent(0, 200)).toBe(false);
    expect(isStaleSubscriptionEvent(Number.NaN, 200)).toBe(false);
  });
});
