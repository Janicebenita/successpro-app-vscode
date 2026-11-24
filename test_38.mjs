import fs from "fs";

const envPath = "D:/successpro-app-vscode/apps/web/.env.local";
const envContent = fs.readFileSync(envPath, "utf8");
let apiKey = "";
for (const line of envContent.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim();
  }
}

async function test38() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`;
  console.log("Calling gemini-3.8-flash...");
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Say hello in one word" }] }],
      generationConfig: { maxOutputTokens: 20 },
    }),
  });
  const body = await res.text();
  console.log(`gemini-3.8-flash: status=${res.status} in ${Date.now() - t0}ms: ${body.slice(0, 150)}`);
}

test38().catch(console.error);
