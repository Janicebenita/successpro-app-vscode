import { execFileSync } from "node:child_process";
import { researchSalaryMarket } from "../src/lib/salary-market";

const gcloud = process.env.GCLOUD_BIN;
if (!gcloud || process.env.GOOGLE_CLOUD_PROJECT !== "successpro-staging-1706786b") throw new Error("Use the dedicated staging project and gcloud binary for this synthetic check.");
const token = execFileSync(gcloud, ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const result = await researchSalaryMarket({ role: "Product Manager", location: "Bengaluru, India", yearsExperience: 8, industry: "Software", currency: "INR" }, {
  accessToken: async () => token,
  models: ["gemini-3.5-flash"],
  timeoutMs: 95_000,
  request: async (url, init) => {
    const response = await fetch(url, init).catch((error: unknown) => {
      console.log(JSON.stringify({ requestError: error instanceof Error ? error.message : String(error) }));
      throw error;
    });
    const body = await response.clone().json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> } | null;
    const output = body?.candidates?.[0]?.content?.parts?.map((item) => item.text).join("") ?? "";
    console.log(JSON.stringify({ model: new URL(url).pathname.split("/").pop(), status: response.status, finishReason: (body?.candidates?.[0] as { finishReason?: string })?.finishReason, outputLength: output.length, candidateKeys: Object.keys(body?.candidates?.[0] ?? {}), groundingKeys: Object.keys(body?.candidates?.[0]?.groundingMetadata ?? {}), supports: (body?.candidates?.[0]?.groundingMetadata as { groundingSupports?: Array<{ segment?: { text?: string }; groundingChunkIndices?: number[] }> })?.groundingSupports?.slice(0, 3), grounding: body?.candidates?.[0]?.groundingMetadata?.groundingChunks?.slice(0, 3).map((item) => ({ uri: item.web?.uri, title: item.web?.title })), responsePreview: output.slice(0, 1000), outputTail: output.slice(-250) }));
    return response;
  },
});
console.log(JSON.stringify({ verifiedSources: result?.sources.length ?? 0, sources: result?.sources.map((source) => source.url), summary: result?.summary }));
