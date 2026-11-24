import { afterEach, describe, expect, it, vi } from "vitest";
import { localDevelopmentOwnerId, nativeResumeEnabled, retryDelaySeconds } from "./config";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; vi.unstubAllEnvs(); });

describe("native resume configuration", () => {
  it("is disabled by default", () => { delete process.env.RESUME_NATIVE_PIPELINE_ENABLED; expect(nativeResumeEnabled()).toBe(false); });
  it("uses bounded exponential retry delays", () => { expect([1, 2, 3, 20].map(retryDelaySeconds)).toEqual([5, 10, 20, 300]); });
  it("never permits the local owner override in production", () => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RESUME_NATIVE_LOCAL_USER_ID", "local-user"); expect(localDevelopmentOwnerId()).toBeNull(); });
});

