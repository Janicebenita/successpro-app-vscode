import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const memberScreens = [
  "src/app/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/billing/page.tsx",
  "src/components/auth-form.tsx",
  "src/components/opportunities-workspace.tsx",
  "src/components/profile-form.tsx",
  "src/components/profile-start.tsx",
  "src/components/resume-review.tsx",
  "src/components/linkedin-makeover.tsx",
  "src/components/goals-workspace.tsx",
  "src/components/salary-workspace.tsx",
  "src/components/messages-workspace.tsx",
  "src/components/career-portrait.tsx",
  "src/components/document-studio.tsx",
];

const implementationPhrases = [
  "deterministic rubric",
  "evidence-led",
  "run strict review",
  "canonical career profile",
  "billing and entitlements",
  "configuration pending",
  "strict successpro benchmark",
  "job connector",
];

describe("member-facing language", () => {
  it("keeps implementation terminology out of primary member screens", () => {
    const copy = memberScreens.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n").toLowerCase();
    for (const phrase of implementationPhrases) expect(copy).not.toContain(phrase);
  });

  it("does not expose sample candidate identities in member screens", () => {
    const copy = memberScreens.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
    expect(copy).not.toContain("Avery Patel");
  });
});
