import fetch from "node:child_process";

const key = "AQ.Ab8RN6JK-keE1bnB0wzal7YqHkE9p8dVel6Kg0mHW41_f_lhKA";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;

async function test(name, body) {
  const start = Date.now();
  const res = await globalThis.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log(name, "Status:", res.status, "Duration:", Date.now() - start, "ms", "Body:", text.slice(0, 150));
}

await test("simple", {
  contents: [{ parts: [{ text: "Hello" }] }],
  generationConfig: {
    maxOutputTokens: 1000,
    thinkingConfig: { thinkingLevel: "LOW" }
  }
});

await test("with responseMimeType json without thinking", {
  contents: [{ parts: [{ text: "Return {\"hello\": \"world\"}" }] }],
  generationConfig: {
    responseMimeType: "application/json",
    maxOutputTokens: 1000
  }
});

await test("with thinkingBudget 0", {
  contents: [{ parts: [{ text: "Return {\"hello\": \"world\"}" }] }],
  generationConfig: {
    responseMimeType: "application/json",
    maxOutputTokens: 1000,
    thinkingConfig: { thinkingBudget: 0 }
  }
});
