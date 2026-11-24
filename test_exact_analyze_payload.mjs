import fs from "fs";

const envPath = "D:/successpro-app-vscode/apps/web/.env.local";
const envContent = fs.readFileSync(envPath, "utf8");
let apiKey = "";
for (const line of envContent.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim();
  }
}

// Let's import orchestrator/task-registry logic
import { promptForTask, aiTaskRegistry } from "./apps/web/src/lib/ai/task-registry.js";
