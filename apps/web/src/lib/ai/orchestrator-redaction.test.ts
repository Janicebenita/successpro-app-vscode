import { describe, expect, it } from "vitest";
import { redact } from "./orchestrator";

describe("AI prompt contact redaction", () => {
  it("preserves abbreviated year ranges in achievement headings while hiding real phone numbers", () => {
    const input = "AWARDS & ACHIEVEMENTS\n2024 - 25 – Bajaj Capital\n2021 - 22 – Bajaj Capital\n2014 - 2016 – American Express\nContact +91-9999688178";
    const output = redact(input) as string;
    expect(output).toContain("2024 - 25 – Bajaj Capital");
    expect(output).toContain("2021 - 22 – Bajaj Capital");
    expect(output).toContain("2014 - 2016 – American Express");
    expect(output).toContain("[redacted phone]");
    expect(output).not.toContain("9999688178");
  });
});
