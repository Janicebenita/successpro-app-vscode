import { expect, it } from "vitest";
import { z } from "zod";
import { aiTaskSchemas } from "@successpro/contracts/ai";

it("publishes the same writing limits to the provider that runtime validation enforces", () => {
  const schema = z.toJSONSchema(aiTaskSchemas.transformResumeProfile.output);
  const profile = schema.properties?.profileDraft;
  expect(profile).toMatchObject({ properties: { skills: { maxItems: 24 }, summary: { maxLength: 1000 } } });
  const extracted = z.toJSONSchema(aiTaskSchemas.extractResumeProfile.output);
  expect(extracted.properties?.profileDraft).toMatchObject({ properties: { skills: { maxItems: 100 }, summary: { maxLength: 20000 } } });
});
