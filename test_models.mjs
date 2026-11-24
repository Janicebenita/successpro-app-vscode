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
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Respond in 2 words: SUCCESS" }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
    });
    const status = res.status;
    const body = await res.text();
    console.log(`[${m}] status=${status} in ${Date.now() - t0}ms: ${body.slice(0, 100)}`);
  } catch (err) {
    console.log(`[${m}] error: ${err.message}`);
  }
}

async function main() {
  for (const m of ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"]) {
    await testModel(m);
  }
}

main().catch(console.error);
