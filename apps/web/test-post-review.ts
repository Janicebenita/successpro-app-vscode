import { POST } from "./src/app/api/reviews/route";

async function testPostReview() {
  const payload = {
    text: "Aparna Khatri\n(212) 256-1414\nChicago, Illinois\naparna.khatri@gmail.com\naparnakhatri.com\n\nPROFILE\nSenior Product Designer with 6+ years of experience leading UI/UX systems. Increased customer retention by 32% and led cross-functional teams.\n\nEXPERIENCE\nLead Product Designer at TechCorp (2020 - Present)\n- Spearheaded design system adoption across 14 mobile applications.\n- Designed onboarding flows reducing abandonment rates by 28%.\n\nEDUCATION\nB.S. in Human Computer Interaction, University of Illinois (2018)\n\nSKILLS\nFigma, Design Systems, User Research, Prototyping, Wireframing",
    targetKeywords: ["Product Designer"],
    jobDescription: "Senior Product Designer with strong Figma and Design Systems experience.",
    documentSignals: {
      fontCount: 1,
      imageOnly: false,
      pageCount: 1,
      smallText: false,
      tableHeavy: false,
      multiColumn: false,
      crowdedLayout: false,
      designWarnings: ["excessive_whitespace", "low_colour_contrast"],
      excessiveColor: true,
      minimumFontSize: 11,
      hasVisualEvidence: true,
      extractionReliable: true,
      excessiveWhitespace: true,
      inconsistentMargins: false,
    },
    processingJobId: "fed7c335-8bfa-469f-aa24-f286c54c35e1",
  };

  const req = new Request("http://localhost:3000/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const res = await POST(req);
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Visual Design Score:", data.result?.visualDesignScore);
  console.log("Visual Design Status:", data.result?.visualDesignStatus);
  console.log("Score Sources:", data.result?.scoreSources);
  console.log("Overall Score:", data.result?.score);
}

testPostReview().catch(console.error);
