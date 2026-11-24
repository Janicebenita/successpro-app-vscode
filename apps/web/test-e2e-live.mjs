async function run() {
  const payload = {
    text: "Experienced Software Engineer with 6 years in full-stack web development. Proficient in TypeScript, React, Node.js, and PostgreSQL. Led engineering projects delivering 35% performance improvement across cloud platforms. Managed team of 4 engineers and improved delivery timelines by 20%. Bachelor of Science in Computer Science from University of Technology, 2018.",
    targetKeywords: ["Software Engineer"],
    documentSignals: { pageCount: 1 }
  };

  console.log("Calling POST http://localhost:3000/api/reviews...");
  const res = await fetch("http://localhost:3000/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  console.log("Status:", res.status);
  if (!res.ok) {
    console.error("Error response:", JSON.stringify(json, null, 2));
  } else {
    console.log("SUCCESS!");
    console.log("Score:", json.result?.score);
    console.log("Score Status:", json.result?.v2?.scoreStatus);
    console.log("Review Status:", json.reviewStatus);
    console.log("Provider:", json.assistant?.meta?.provider);
    console.log("Validation:", json.assistant?.meta?.validation);
    console.log("AnalysisId:", json.analysisId);
  }
}
run();
