import { aiTaskSchemas } from "@successpro/contracts/ai";
import { z } from "zod";

const key = "AQ.Ab8RN6JK-keE1bnB0wzal7YqHkE9p8dVel6Kg0mHW41_f_lhKA";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;

const schema = z.toJSONSchema(aiTaskSchemas.analyzeResume.output);
delete schema.$schema;
delete schema.properties.criteria;

const compact = (value) => {
  if (Array.isArray(value)) return value.map(compact);
  if (!value || typeof value !== "object") return value;
  const keep = new Set(["type", "properties", "required", "items", "enum"]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => keep.has(k))
      .map(([k, v]) => [k, k === "properties" ? Object.fromEntries(Object.entries(v).map(([name, child]) => [name, compact(child)])) : compact(v)])
  );
};

const structural = compact(schema);

async function test(name, body) {
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log(name, "Status:", res.status, "Duration:", Date.now() - start, "ms", "Body:", text.slice(0, 150));
}

await test("with structural schema", {
  contents: [{ parts: [{ text: "Evaluate this resume and return JSON according to schema: John Doe, software engineer" }] }],
  generationConfig: {
    responseMimeType: "application/json",
    responseJsonSchema: structural,
    thinkingConfig: { thinkingLevel: "LOW" },
    maxOutputTokens: 8000
  }
});
