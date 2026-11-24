import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env.local") });

import { loadAiConfig, usableProviderConfigs } from "./apps/web/src/lib/ai/config";

async function main() {
  const config = await loadAiConfig();
  console.log("Config:", JSON.stringify(config, null, 2));
  console.log("Usable:", usableProviderConfigs(config, "personal", "analyzeResume"));
}

main().catch(console.error);
