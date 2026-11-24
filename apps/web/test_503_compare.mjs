const key = "AQ.Ab8RN6JK-keE1bnB0wzal7YqHkE9p8dVel6Kg0mHW41_f_lhKA";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;

const prompt = "Act as a resume assessor. Evaluate this resume:\n" + "Software engineer with 5 years experience in Python, TypeScript, React.\n".repeat(50);

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

await test("NO thinkingConfig", {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
    maxOutputTokens: 2000
  }
});

await test("WITH thinkingLevel LOW", {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
    maxOutputTokens: 2000,
    thinkingConfig: { thinkingLevel: "LOW" }
  }
});
