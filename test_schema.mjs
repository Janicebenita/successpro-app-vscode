import fs from "fs";

const envPath = "D:/successpro-app-vscode/apps/web/.env.local";
const envContent = fs.readFileSync(envPath, "utf8");
let apiKey = "";
for (const line of envContent.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim();
  }
}

async function testModel(m) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Respond in JSON: {\"status\": \"ok\"}" }] }],
        generationConfig: { maxOutputTokens: 100, responseMimeType: "application/json" },
      }),
    });
    const body = await res.text();
    console.log(`[${m}] status=${res.status}: ${body.slice(0, 150)}`);
  } catch (err) {
    console.log(`[${m}] error: ${err.message}`);
  }
}

async function main() {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-flash-latest",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ];
  for (const m of models) {
    await testModel(m);
  }
}

main().catch(console.error);
