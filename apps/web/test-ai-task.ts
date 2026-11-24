import { analyzeResume } from "@successpro/domain";
import { runAiTask } from "./src/lib/ai/orchestrator";

async function main() {
  console.log("Calling runAiTask('analyzeResume')...");
  const input = {
    text: "John Doe\nSenior Software Engineer\nExperience: Led cloud migration at Google saving $2M annually. Optimized distributed database queries reducing p99 latency by 45%. Spearheaded adoption of Go and Kubernetes across 8 teams.\nSkills: Go, Python, Kubernetes, MySQL, Distributed Systems.",
    targetKeywords: ["Software Engineer", "Go", "Cloud"],
    jobDescription: "",
  };
  const deterministicReview = analyzeResume(input);
  try {
    const res = await runAiTask(
      "analyzeResume",
      {
        resumeText: input.text,
        deterministicReview,
        targetRole: input.targetKeywords.join(", "),
        jobDescription: input.jobDescription,
        documentSignals: undefined,
      },
      { ownerId: "test-user", sensitivity: "personal", preferredLanguage: "en" }
    );
    console.log("RESULT VALIDATION:", res.meta.validation);
    console.log("CRITERIA COUNT:", res.output.criteria?.length);
    if (res.output.criteria) {
      console.log("CRITERIA:", JSON.stringify(res.output.criteria, null, 2));
    }
  } catch (err) {
    console.error("ERROR IN RUN_AI_TASK:", err);
  }
}

main();
