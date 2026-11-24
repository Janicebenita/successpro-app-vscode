import fs from "fs";

const envPath = "D:/successpro-app-vscode/apps/web/.env.local";
const envContent = fs.readFileSync(envPath, "utf8");
let apiKey = "";
for (const line of envContent.split("\n")) {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim();
  }
}

async function testModelThinking(model, thinkingLevel) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  console.log(`\nTesting model: ${model} with thinkingLevel: ${thinkingLevel}...`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Say hello in one word" }] }],
        generationConfig: {
          maxOutputTokens: 100,
          responseMimeType: "application/json",
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {})
        },
      }),
    });
    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Response text:", text.slice(0, 300));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

async function main() {
  await testModelThinking("gemini-3.5-flash-lite", "LOW");
  await testModelThinking("gemini-3.5-flash", "MEDIUM");
  await testModelThinking("gemini-3.5-flash", null);
  await testModelThinking("gemini-3.8-flash", "MEDIUM");
}

main().catch(console.error);
