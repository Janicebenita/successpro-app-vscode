import { describe, expect, it } from "vitest";
import { parsePublicEnvironment } from "./environment";

describe("public environment", () => {
  it("uses safe local defaults", () => {
    expect(parsePublicEnvironment({})).toEqual({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXT_PUBLIC_ENVIRONMENT: "development" });
  });

  it("rejects unknown environments", () => {
    expect(() => parsePublicEnvironment({ NEXT_PUBLIC_ENVIRONMENT: "prod" })).toThrow();
  });
});
