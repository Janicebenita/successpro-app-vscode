import type { GapRiskFinding } from "./types";

export function analyzeMissingInformation(
  text: string,
  targetJobDescription = ""
): GapRiskFinding[] {
  const findings: GapRiskFinding[] = [];

  // 1. Mandatory Contact Details
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (!emailMatch) {
    findings.push({
      id: "missing-contact-email",
      title: "Missing Email Address",
      category: "missing_information",
      severity: "Critical",
      evidenceExcerpt: "Contact section lacks a valid email format.",
      explanation: "No standard email address could be detected on the resume.",
      whyItMatters: "Email is the primary communication channel for automated ATS systems and recruiters. Without it, you cannot be contacted for interviews.",
      recommendedCorrection: "Add a professional email address (e.g. name@example.com) clearly in your header.",
      confidence: "High",
      isMandatory: true,
    });
  }

  const phoneMatch = text.match(/\b(?:\+?61\s*|0)4\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/) ||
    text.match(/\b(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,4}\d{2,4}\b/) ||
    text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}/);
  if (!phoneMatch) {
    findings.push({
      id: "missing-contact-phone",
      title: "Missing Phone Number",
      category: "missing_information",
      severity: "Critical",
      evidenceExcerpt: "Contact section lacks a recognized phone number pattern.",
      explanation: "No direct telephone or mobile number could be extracted from your header or contact information.",
      whyItMatters: "Recruiters frequently call or send SMS confirmations before scheduling formal interviews.",
      recommendedCorrection: "Add a valid mobile phone number with country/area code in your resume header.",
      confidence: "High",
      isMandatory: true,
    });
  }

  const locationMatch = text.match(/\b(?:[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\b|[A-Z][a-zA-Z\s]+,\s*(?:USA|India|UK|Canada|Germany|Australia|Singapore)|Chennai|Bangalore|Bengaluru|Hyderabad|Mumbai|Delhi|San Francisco|New York|London|Seattle|Austin|Chicago|Toronto|Remote)\b/i);
  if (!locationMatch) {
    findings.push({
      id: "missing-contact-location",
      title: "Missing Location / City & Country",
      category: "missing_information",
      severity: "High",
      evidenceExcerpt: "No recognized city, state, or metropolitan area detected in the header.",
      explanation: "Your resume does not clearly list your current city, state, or country.",
      whyItMatters: "Many ATS filters screen candidates by geographic proximity, work authorization regions, or time zone suitability.",
      recommendedCorrection: "Include your City and Country or State (e.g., 'Chennai, India' or 'San Francisco, CA (Open to Remote)') in your header.",
      confidence: "Medium",
      isMandatory: true,
    });
  }

  const linkedInMatch = text.match(/linkedin\.com\/in\/[A-Za-z0-9_-]+/i) || text.match(/\blinkedin\b/i);
  if (!linkedInMatch) {
    findings.push({
      id: "missing-contact-linkedin",
      title: "Missing LinkedIn Profile Link",
      category: "missing_information",
      severity: "Low",
      evidenceExcerpt: "No LinkedIn profile URL or handle detected.",
      explanation: "Modern tech recruiters almost universally cross-reference resume submissions with LinkedIn profiles.",
      whyItMatters: "A verifiable LinkedIn URL provides instant credential validation, endorsements, and social proof.",
      recommendedCorrection: "Add your customized LinkedIn URL (e.g. linkedin.com/in/yourname) in your contact header.",
      confidence: "High",
      isMandatory: false,
    });
  }

  // 2. Education Section Details
  const hasEducationHeader = /(?:education|academic\s+(?:details|background|qualifications)|educational\s+qualifications)\b/i.test(text);
  if (!hasEducationHeader) {
    findings.push({
      id: "missing-education-section",
      title: "Missing Education Section",
      category: "missing_information",
      severity: "High",
      evidenceExcerpt: "No dedicated Education or Academic background heading found.",
      explanation: "A distinct Education section could not be identified on your resume.",
      whyItMatters: "Many enterprise and corporate ATS screening algorithms enforce a minimum degree requirement.",
      recommendedCorrection: "Add an 'Education' section listing your degree, major, institution name, and year of graduation.",
      confidence: "High",
      isMandatory: true,
    });
  } else {
    // Check degree detail
    const hasDegree = /\b(?:bachelor|master|b\.?tech|b\.?e\.?|m\.?tech|m\.?s\.?|ph\.?d|b\.?sc|m\.?sc|mba|bba|diploma|associate)\b/i.test(text);
    if (!hasDegree) {
      findings.push({
        id: "missing-degree-specification",
        title: "Degree or Major Not Clearly Specified",
        category: "missing_information",
        severity: "Medium",
        evidenceExcerpt: "Education section found, but degree title (e.g. B.Tech, Master of Science) is unstated.",
        explanation: "Your education section lists an institution or year, but does not clearly specify your degree level or field of study.",
        whyItMatters: "ATS keyword filters look for specific degree classifications like Bachelor of Science or Master's.",
        recommendedCorrection: "Explicitly state your degree and field of study (e.g., 'Bachelor of Technology in Computer Science').",
        confidence: "Medium",
        isMandatory: false,
      });
    }
  }

  // 3. Professional Summary for Experienced Candidates
  const hasSummary = /(?:professional\s+summary|executive\s+summary|career\s+profile|about\s+me|summary)\b/i.test(text);
  const yearsExpMatch = text.match(/\b(\d+)\+?\s*years?\s+(?:of\s+)?(?:professional|total|work)?\s*experience\b/i);
  const claimedYears = yearsExpMatch ? Number(yearsExpMatch[1]) : 0;
  if (!hasSummary && claimedYears >= 3) {
    findings.push({
      id: "missing-professional-summary",
      title: "Missing Professional Executive Summary",
      category: "missing_information",
      severity: "Medium",
      evidenceExcerpt: "Resume transitions directly from contact info to work experience without a summary profile.",
      explanation: "With 3+ years of experience, a 3-to-4 line executive summary sets the narrative before recruiters read bullet points.",
      whyItMatters: "Recruiters spend 6 to 8 seconds on initial scans. A crisp executive summary immediately highlights your core domain, leadership scope, and biggest career wins.",
      recommendedCorrection: "Add a concise 3-sentence 'Professional Summary' at the top highlighting your primary specialization, core technologies, and standout achievements.",
      confidence: "High",
      isMandatory: false,
    });
  }

  // Scoped counts and changes are different kinds of evidence. An unverified
  // audience result is optional and does not erase a documented deliverable.
  const bulletLines = text.split(/\r?\n/).filter((line) => /^\s*[•*◦▪‣-]\s+/u.test(line));
  const scopeMetric = /(?:[$₹€£]\s*\d|\b\d+(?:[.,]\d+)?\s*(?:%|×|x\b)|\b\d[\d,]*(?:\.\d+)?\+?\s+(?:[\p{L}][\p{L}-]*\s+){0,3}(?:recipes|chapters|activities|books|e-books|scripts|posts|articles|stories|pages|words|videos|lessons|editions|guides|projects|campaigns|pieces|deliverables|subscribers|downloads|views|clients|customers|users|staff|employees|teams|countries|markets|days|hours|months|years|million|billion|thousand|crore|lakh)\b|\b\d+[MBK]\b|\b\d{1,3}(?:,\d{3})+\b)/iu;
  if (bulletLines.length >= 4 && !bulletLines.some((line) => scopeMetric.test(line))) {
    findings.push({
      id: "missing-measurable-achievements",
      title: "Project Scope or Results Could Be More Specific",
      category: "missing_information",
      severity: "Medium",
      evidenceExcerpt: bulletLines[0].trim(),
      explanation: "The bullet scan did not find a clear count, scale, or measured result. Review the cited example for any scope or outcome you can verify.",
      whyItMatters: "Specific scope and outcomes help a reader understand the work and its effect.",
      recommendedCorrection: "Where known, add a verified count, the size of the work, or a documented result. A concrete qualitative outcome can help when measurements are unavailable.",
      confidence: "Medium",
      isMandatory: false,
    });
  }

  // 5. Job Description Skills Gap (when JD provided)
  if (targetJobDescription.trim().length >= 80) {
    const jdWords = targetJobDescription.match(/\b(?:Python|Java|TypeScript|JavaScript|AWS|Azure|GCP|Docker|Kubernetes|PyTorch|TensorFlow|React|Node\.?js|SQL|NoSQL|PostgreSQL|CI\/CD|Microservices|REST|GraphQL|Kafka|Spark|LLM|GenAI|Machine Learning|Deep Learning)\b/gi) ?? [];
    const uniqueJdSkills = [...new Set(jdWords.map((w) => w.toLowerCase()))];
    const missingSkills = uniqueJdSkills.filter((skill) => !new RegExp(`\\b${skill}\\b`, "i").test(text));

    if (missingSkills.length >= 3) {
      const topMissing = missingSkills.slice(0, 5).map((s) => s.toUpperCase());
      findings.push({
        id: "missing-target-job-skills",
        title: `Missing High-Priority Target Job Skills (${topMissing.join(", ")})`,
        category: "missing_information",
        severity: "High",
        evidenceExcerpt: `Target Job requires: ${topMissing.join(", ")} (not found in resume text).`,
        explanation: `The targeted job description emphasizes skills like ${topMissing.join(", ")}, which do not appear anywhere in your resume.`,
        whyItMatters: "ATS keyword filters score resumes on exact and semantic keyword overlap. Missing core technologies reduces interview callback rates.",
        recommendedCorrection: `If you have hands-on experience with ${topMissing.join(", ")}, incorporate them with practical context into your technical skills section and role achievement bullets.`,
        confidence: "High",
        isMandatory: false,
      });
    }
  }

  return findings;
}
