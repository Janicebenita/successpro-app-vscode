import type { JobMatchInput, JobMatchResult } from "@successpro/contracts";
import { jobMatchInputSchema } from "@successpro/contracts";

// Curated technical and domain multi-word concepts (N-grams)
const KNOWN_PHRASES: Array<{ canonical: string; variants: string[] }> = [
  // AI, ML & Data Science
  { canonical: "Deep Learning", variants: ["deep learning", "deep neural networks", "dnn"] },
  { canonical: "Neural Networks", variants: ["neural networks", "neural network", "artificial neural networks", "ann", "cnn", "rnn"] },
  { canonical: "Artificial Intelligence", variants: ["artificial intelligence", "ai systems", "ai technologies"] },
  { canonical: "Machine Learning", variants: ["machine learning", "ml algorithms", "ml models"] },
  { canonical: "Computer Vision", variants: ["computer vision", "image processing", "object detection", "image classification"] },
  { canonical: "Natural Language Processing", variants: ["natural language processing", "nlp", "text mining", "text analytics"] },
  { canonical: "Large Language Models", variants: ["large language models", "llm", "llms", "generative ai", "genai", "prompt engineering", "rag", "retrieval augmented generation"] },
  { canonical: "Data Science", variants: ["data science", "statistical modeling", "predictive modeling"] },
  { canonical: "Data Engineering", variants: ["data engineering", "data pipelines", "etl pipelines", "data ingestion"] },
  { canonical: "Big Data", variants: ["big data", "data lake", "data warehouse", "lakehouse"] },
  { canonical: "Model Deployment", variants: ["model deployment", "model serving", "mlops", "production models", "production deployment"] },
  { canonical: "Reinforcement Learning", variants: ["reinforcement learning", "rl"] },

  // Cloud & Infrastructure
  { canonical: "Cloud Computing", variants: ["cloud computing", "cloud infrastructure", "cloud solutions", "cloud services"] },
  { canonical: "Cloud Architecture", variants: ["cloud architecture", "cloud migration", "cloud native"] },
  { canonical: "AWS", variants: ["aws", "amazon web services", "amazon aws"] },
  { canonical: "Azure", variants: ["azure", "microsoft azure"] },
  { canonical: "Google Cloud", variants: ["google cloud", "gcp", "google cloud platform"] },
  { canonical: "Palantir Foundry", variants: ["palantir foundry", "palantir platform", "palantir"] },
  { canonical: "Docker", variants: ["docker", "containerization", "docker containers"] },
  { canonical: "Kubernetes", variants: ["kubernetes", "k8s", "container orchestration"] },
  { canonical: "CI/CD", variants: ["ci/cd", "continuous integration", "continuous deployment", "build pipelines"] },
  { canonical: "Infrastructure as Code", variants: ["infrastructure as code", "iac", "terraform", "ansible", "cloudformation"] },
  { canonical: "Microservices", variants: ["microservices", "microservices architecture", "distributed systems"] },
  { canonical: "RESTful APIs", variants: ["restful api", "rest api", "rest apis", "api design", "web services"] },
  { canonical: "System Architecture", variants: ["system architecture", "software architecture", "high availability", "scalability"] },

  // Data & Backend
  { canonical: "Databases", variants: ["database management", "relational databases", "nosql databases"] },
  { canonical: "Apache Spark", variants: ["apache spark", "spark", "pyspark"] },
  { canonical: "Apache Kafka", variants: ["apache kafka", "kafka", "event streaming", "message queues"] },
  { canonical: "Snowflake", variants: ["snowflake", "databricks"] },

  // Practices & Management
  { canonical: "Agile / Scrum", variants: ["agile", "scrum", "sprint planning", "kanban"] },
  { canonical: "Project Management", variants: ["project management", "technical project management", "program management"] },
  { canonical: "Stakeholder Management", variants: ["stakeholder management", "stakeholder engagement", "cross functional collaboration"] },
  { canonical: "Quality Assurance", variants: ["quality assurance", "unit testing", "automated testing", "test automation", "qa"] },
  { canonical: "Code Review", variants: ["code review", "peer reviews", "code quality"] },
];

// Single-word hard skills, tools, languages, and technical frameworks
const KNOWN_SKILLS: Record<string, string> = {
  python: "Python",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  keras: "Keras",
  scikit: "Scikit-Learn",
  sklearn: "Scikit-Learn",
  opencv: "OpenCV",
  pandas: "Pandas",
  numpy: "NumPy",
  scipy: "SciPy",
  sql: "SQL",
  nosql: "NoSQL",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  redis: "Redis",
  elasticsearch: "Elasticsearch",
  java: "Java",
  scala: "Scala",
  kotlin: "Kotlin",
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  angular: "Angular",
  vue: "Vue.js",
  node: "Node.js",
  nodejs: "Node.js",
  fastapi: "FastAPI",
  flask: "Flask",
  django: "Django",
  spring: "Spring Boot",
  palantir: "Palantir",
  tableau: "Tableau",
  powerbi: "Power BI",
  hadoop: "Hadoop",
  spark: "Apache Spark",
  pyspark: "PySpark",
  kafka: "Apache Kafka",
  terraform: "Terraform",
  docker: "Docker",
  kubernetes: "Kubernetes",
  git: "Git",
  linux: "Linux",
  bash: "Bash",
  golang: "Go",
  go: "Go",
  rust: "Rust",
  cpp: "C++",
  "c++": "C++",
  "c#": "C#",
  csharp: "C#",
  airflow: "Apache Airflow",
  dbt: "dbt",
};

// Generic filler words, stopwords, and non-skill terms to reject
const STOP_WORDS = new Set([
  "a", "about", "above", "across", "after", "again", "against", "all", "almost", "along", "also",
  "am", "among", "an", "and", "another", "any", "anybody", "anyone", "anything", "are", "around",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "could", "did", "do", "does", "doing", "done", "down", "during", "each", "either", "else",
  "even", "every", "everyone", "everything", "few", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in",
  "into", "is", "it", "its", "itself", "just", "may", "me", "might", "more", "most", "must", "my",
  "myself", "neither", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other",
  "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "someone",
  "something", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
  "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very",
  "was", "we", "were", "what", "whatever", "when", "where", "which", "while", "who", "whom", "whose",
  "why", "will", "with", "within", "without", "would", "you", "your", "yours", "yourself", "yourselves",
  // Generic job description / corporate filler words
  "ability", "able", "action", "activities", "addition", "additional", "advantage", "aligned",
  "allow", "allowed", "always", "annual", "applicant", "applicants", "application", "applications",
  "apply", "applying", "appropriate", "approximate", "area", "areas", "aspects", "assigned", "assist",
  "assistance", "assisting", "associated", "attention", "attitude", "background", "basic", "basis",
  "benefit", "benefits", "best", "better", "bonus", "bring", "broad", "build", "building", "built",
  "business", "candidate", "candidates", "career", "careers", "case", "cases", "chance", "change",
  "check", "checks", "city", "clear", "clearly", "close", "closely", "collaborate", "collaborating",
  "collaboration", "collaborative", "colleagues", "combine", "combined", "come", "comfortable",
  "common", "communication", "communications", "company", "competitive", "complete", "completed",
  "complex", "compliance", "comply", "comprehend", "comprehensive", "computer", "concept", "concepts",
  "condition", "conditions", "conduct", "conducting", "confidence", "confident", "consistent",
  "constantly", "contact", "contacts", "content", "continue", "continuous", "contribute", "contributing",
  "contribution", "control", "controls", "coordinate", "coordinating", "core", "corporate", "correct",
  "cost", "costs", "country", "create", "creating", "creation", "creative", "critical", "culture",
  "current", "currently", "daily", "day", "days", "deal", "dealing", "decision", "decisions", "deep",
  "defined", "defining", "deliver", "delivered", "delivering", "delivery", "demonstrate", "demonstrated",
  "demonstrating", "department", "departments", "depend", "depending", "describe", "described",
  "description", "descriptions", "desirable", "desired", "detail", "detailed", "details", "develop",
  "developer", "developers", "developing", "development", "different", "difficult", "direction",
  "directly", "discipline", "disciplines", "diverse", "diversity", "document", "documentation",
  "documented", "documents", "drive", "driven", "drives", "driving", "due", "duties", "dynamic",
  "early", "effective", "effectively", "efficiency", "efficient", "effort", "efforts", "element",
  "elements", "eligibility", "eligible", "emphasis", "employ", "employed", "employee", "employees",
  "employer", "employment", "enable", "enabling", "encourage", "end", "energy", "engage", "engagement",
  "engaging", "engineer", "engineering", "engineers", "enhance", "enhancing", "ensure", "ensuring",
  "enterprise", "enthusiasm", "entire", "entry", "environment", "environments", "equal", "equipment",
  "equivalent", "essential", "establish", "established", "establishing", "evaluate", "evaluating",
  "evaluation", "event", "events", "everyday", "evidence", "exact", "exceed", "excellence", "excellent",
  "execute", "executing", "execution", "existing", "expand", "expanding", "expect", "expectations",
  "expected", "experience", "experienced", "experiences", "expert", "expertise", "experts", "exposure",
  "extended", "external", "extra", "facilitate", "factors", "familiar", "familiarity", "fast", "feature",
  "features", "feedback", "field", "fields", "figure", "final", "find", "finding", "findings", "first",
  "fit", "flexible", "focus", "focused", "focusing", "follow", "following", "format", "forward",
  "foster", "found", "foundation", "free", "fresh", "front", "full", "full-time", "function",
  "functional", "functioning", "functions", "fundamental", "future", "gain", "gained", "general",
  "generally", "generate", "generating", "generation", "get", "getting", "give", "given", "giving",
  "global", "goal", "goals", "good", "great", "group", "groups", "grow", "growing", "growth", "guide",
  "guidelines", "guides", "hand", "hands", "hands-on", "happen", "happy", "hard", "have", "head",
  "health", "hear", "help", "helpful", "helping", "high", "higher", "highly", "hire", "hiring",
  "history", "hold", "holding", "holiday", "home", "hope", "hour", "hours", "house", "human", "idea",
  "ideas", "identify", "identifying", "impact", "impactful", "implement", "implementation",
  "implementing", "importance", "important", "improve", "improvement", "improvements", "improving",
  "include", "included", "includes", "including", "incorporate", "increase", "increasing", "individual",
  "individuals", "industry", "influence", "influencing", "information", "initiative", "initiatives",
  "innovate", "innovating", "innovation", "innovative", "input", "inputs", "inside", "insight",
  "insights", "inspire", "inspiring", "install", "installation", "instead", "instruction",
  "instructions", "insurance", "integrate", "integrated", "integrating", "integration", "integrity",
  "intelligence", "intelligent", "intend", "intended", "intense", "interact", "interaction",
  "interactions", "interest", "interested", "interesting", "intermediate", "internal", "international",
  "interpersonal", "interview", "interviews", "introduce", "introduced", "introduction", "involve",
  "involved", "involvement", "involving", "issue", "issues", "item", "items", "job", "jobs", "join",
  "joining", "journey", "junior", "keep", "keeping", "key", "kind", "knew", "know", "knowing",
  "knowledge", "known", "knows", "large", "larger", "latest", "launch", "launching", "lead", "leader",
  "leaders", "leadership", "leading", "learn", "learner", "learning", "leave", "led", "level", "levels",
  "leverage", "leveraging", "life", "like", "limit", "limited", "line", "lines", "linked", "list",
  "listed", "live", "local", "location", "locations", "long", "look", "looking", "lot", "low", "lower",
  "maintain", "maintaining", "maintenance", "major", "make", "makes", "making", "manage", "managed",
  "management", "manager", "managers", "managing", "manner", "many", "matter", "matters", "maximum",
  "meaningful", "means", "measure", "measured", "measures", "medium", "meet", "meeting", "meetings",
  "member", "members", "mention", "mentioned", "mentor", "mentoring", "mentors", "method", "methods",
  "mind", "mindset", "minimal", "minimum", "minute", "minutes", "mission", "mix", "mode", "model",
  "models", "modern", "month", "months", "multiple", "must-have", "name", "national", "native",
  "nature", "near", "neat", "necessary", "need", "needed", "needs", "network", "networks", "new",
  "next", "nice", "nice-to-have", "night", "normal", "normally", "note", "noted", "notes", "number",
  "numbers", "objective", "objectives", "obtain", "obtained", "obtaining", "obvious", "offer",
  "offered", "offering", "offers", "office", "offices", "official", "often", "ongoing", "online",
  "open", "opening", "openings", "operate", "operating", "operation", "operational", "operations",
  "opportunity", "options", "order", "organization", "organizational", "organizations", "organize",
  "organized", "organizing", "origin", "original", "outcome", "outcomes", "output", "outputs",
  "overall", "oversee", "overseeing", "overview", "package", "page", "pages", "paid", "part",
  "participate", "participating", "participation", "particular", "particularly", "parties", "partner",
  "partners", "partnership", "partnerships", "part-time", "pass", "passion", "passionate", "past",
  "path", "patient", "pattern", "patterns", "pay", "peer", "peers", "people", "per", "percent",
  "percentage", "perfect", "perform", "performance", "performed", "performing", "period", "permanent",
  "person", "personal", "personality", "perspective", "pertain", "pertaining", "phase", "phases",
  "phenomenal", "philosophy", "phone", "phrase", "physical", "pick", "piece", "pieces", "place",
  "placed", "places", "plan", "planned", "planning", "plans", "platform", "platforms", "please",
  "plenty", "plus", "point", "points", "policies", "policy", "pool", "position", "positions",
  "positive", "possess", "possessing", "possible", "potential", "potentiality", "power", "practice",
  "practices", "prefer", "preferable", "preferably", "preferred", "premises", "preparation", "prepare",
  "prepared", "preparing", "presence", "present", "presentation", "presentations", "presented",
  "presenting", "preserve", "president", "press", "pressure", "previous", "previously", "primary",
  "prime", "principle", "principles", "prior", "priorities", "prioritize", "prioritizing", "priority",
  "private", "proactive", "problem", "problems", "procedure", "procedures", "proceed", "process",
  "processes", "processing", "produce", "produced", "producing", "product", "production", "productive",
  "productivity", "products", "profession", "professional", "professionals", "proficiency",
  "proficient", "profile", "profiles", "program", "programs", "progress", "progressive", "project",
  "projects", "promise", "promote", "promoting", "promotion", "prompt", "proper", "properly",
  "propose", "proposed", "protect", "proud", "provide", "provided", "provides", "providing", "public",
  "purpose", "pursue", "pursuing", "qualification", "qualifications", "qualified", "qualify", "quality",
  "question", "questions", "quick", "quickly", "quite", "range", "rapid", "rate", "reach", "reaching",
  "ready", "real", "realistic", "really", "reason", "reasons", "receive", "received", "recent",
  "recently", "recognize", "recognized", "recommend", "recommendation", "recommendations", "record",
  "records", "recruit", "recruiter", "recruiting", "recruitment", "reference", "references", "referral",
  "reflect", "regard", "regarding", "regular", "regularly", "regulate", "regulation", "regulations",
  "reimbursement", "reinforce", "relate", "related", "relating", "relation", "relations", "relationship",
  "relationships", "relative", "relevant", "reliable", "reliability", "rely", "remain", "remaining",
  "remote", "repeat", "repeated", "report", "reported", "reporting", "reports", "represent",
  "representative", "request", "requests", "require", "required", "requirement", "requirements",
  "requires", "requiring", "research", "researching", "resolution", "resolve", "resolved", "resolving",
  "resource", "resources", "respect", "respective", "respond", "responding", "response", "responses",
  "responsibility", "responsibilities", "responsible", "responsive", "result", "resulting", "results",
  "resume", "resumes", "retention", "review", "reviewed", "reviewing", "reviews", "reward", "rewards",
  "right", "rights", "rigorous", "risk", "risks", "roadmap", "robust", "role", "roles", "routine",
  "routines", "rule", "rules", "run", "running", "safe", "safety", "salary", "sale", "sales", "same",
  "sample", "samples", "save", "saving", "scale", "scaled", "scaling", "schedule", "schedules",
  "scheduling", "scheme", "scope", "score", "scores", "search", "searching", "seat", "second",
  "secondary", "section", "sections", "secure", "securing", "security", "seek", "seeking", "select",
  "selected", "selection", "self", "self-motivated", "send", "sending", "senior", "sense", "separate",
  "serve", "server", "servers", "service", "services", "serving", "session", "sessions", "set", "sets",
  "setting", "settings", "setup", "several", "share", "shared", "sharing", "shift", "short", "show",
  "showed", "showing", "shown", "side", "sight", "sign", "signal", "signals", "significant",
  "significantly", "similar", "simple", "simply", "single", "site", "sites", "situation", "situations",
  "size", "skill", "skilled", "skills", "slow", "small", "smaller", "smooth", "social", "solid",
  "solution", "solutions", "solve", "solved", "solving", "somebody", "somehow", "someone", "something",
  "sometime", "sometimes", "somewhere", "soon", "sort", "sound", "source", "sources", "space",
  "spans", "speak", "speaking", "special", "specialist", "specialists", "specific", "specifically",
  "specification", "specifications", "speed", "spend", "spending", "spot", "staff", "stage", "stages",
  "stakeholder", "stakeholders", "standard", "standards", "standout", "start", "started", "starting",
  "starts", "state", "statement", "statements", "states", "stay", "step", "steps", "stock", "stop",
  "strategic", "strategies", "strategy", "strength", "strengths", "strong", "strongly", "structure",
  "structured", "structures", "student", "students", "studies", "study", "studying", "style", "subject",
  "submit", "submitted", "succeed", "success", "successful", "successfully", "suggest", "suitable",
  "summary", "support", "supported", "supporting", "supports", "sure", "system", "systems", "tackle",
  "tactical", "take", "taken", "takes", "taking", "talent", "talented", "target", "targets", "task",
  "tasks", "teach", "teaching", "team", "teammate", "teammates", "teams", "teamwork", "technical",
  "technically", "technique", "techniques", "technologies", "technology", "term", "terms", "test",
  "tested", "testing", "tests", "text", "thank", "thanks", "theory", "thing", "things", "think",
  "thinking", "thorough", "thought", "thoughts", "time", "timely", "times", "today", "together", "tone",
  "tool", "tools", "top", "total", "track", "tracked", "tracking", "trade", "traditional", "train",
  "trained", "trainer", "training", "transfer", "transferable", "transform", "transformation",
  "transforming", "transition", "travel", "treat", "trend", "trends", "true", "truly", "trust",
  "turn", "type", "types", "typical", "typically", "ultimate", "ultimately", "uncover", "undergo",
  "understand", "understanding", "understands", "understood", "unique", "unit", "units", "universal",
  "unknown", "unmet", "update", "updated", "updates", "updating", "upgrade", "upper", "urgent", "us",
  "usage", "use", "used", "useful", "user", "users", "uses", "using", "usual", "usually", "utilize",
  "utilized", "utilizes", "utilizing", "valid", "validate", "validating", "validation", "valuable",
  "value", "valued", "values", "variety", "various", "vary", "varying", "version", "versions",
  "view", "viewed", "views", "vision", "visual", "vital", "voice", "volume", "wait", "want", "wanted",
  "wants", "waste", "watch", "way", "ways", "week", "weekly", "weeks", "weight", "welcome", "well",
  "wide", "widely", "willing", "win", "wish", "word", "words", "work", "worked", "worker", "workers",
  "working", "workplace", "works", "world", "worldwide", "worth", "write", "writing", "written",
  "wrong", "year", "years", "yield", "zone", "india", "bachelor", "bachelors", "master", "masters", "degree", "education"
]);

function cleanToken(token: string): string {
  return token.trim().replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/gi, "");
}

function normalizeForSearch(text: string): string {
  return " " + text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ") + " ";
}

function hasTerm(haystack: string, term: string): boolean {
  const clean = term.toLowerCase().trim();
  if (!clean) return false;
  // Exact phrase match with boundary spacing
  const targetPattern = " " + clean.replace(/[^a-z0-9+#]+/g, " ").trim() + " ";
  if (haystack.includes(targetPattern)) return true;

  // Handle plural / singular variants
  if (clean.endsWith("s") && clean.length > 3) {
    const singularPattern = " " + clean.slice(0, -1) + " ";
    if (haystack.includes(singularPattern)) return true;
  } else if (!clean.endsWith("s")) {
    const pluralPattern = " " + clean + "s ";
    if (haystack.includes(pluralPattern)) return true;
  }

  // Handle specific common acronyms
  if (clean === "artificial intelligence" && haystack.includes(" ai ")) return true;
  if (clean === "machine learning" && haystack.includes(" ml ")) return true;
  if (clean === "natural language processing" && haystack.includes(" nlp ")) return true;
  if (clean === "deep learning" && (haystack.includes(" neural network ") || haystack.includes(" neural networks "))) return true;
  if (clean === "large language models" && (haystack.includes(" llm ") || haystack.includes(" llms "))) return true;
  if (clean === "amazon web services" && haystack.includes(" aws ")) return true;
  if (clean === "google cloud platform" && (haystack.includes(" gcp ") || haystack.includes(" google cloud "))) return true;
  if (clean === "microsoft azure" && haystack.includes(" azure ")) return true;
  if (clean === "typescript" && haystack.includes(" ts ")) return true;
  if (clean === "javascript" && haystack.includes(" js ")) return true;
  if (clean === "kubernetes" && haystack.includes(" k8s ")) return true;

  return false;
}

export function analyzeJobMatch(input: JobMatchInput): JobMatchResult {
  const parsed = jobMatchInputSchema.parse(input);
  const normalizedResume = normalizeForSearch(parsed.resumeText);
  const normalizedJob = normalizeForSearch(parsed.jobDescription);

  const targetSet = new Map<string, string>(); // canonicalName -> searchKey

  // 1. Scan for known multi-word domain phrases in the Job Description
  for (const phrase of KNOWN_PHRASES) {
    const inJob = phrase.variants.some((v) => hasTerm(normalizedJob, v));
    if (inJob) {
      targetSet.set(phrase.canonical, phrase.variants[0]);
    }
  }

  // 2. Scan for known technical single-word skills in the Job Description
  for (const [key, displayName] of Object.entries(KNOWN_SKILLS)) {
    if (hasTerm(normalizedJob, key)) {
      if (!targetSet.has(displayName)) {
        targetSet.set(displayName, key);
      }
    }
  }

  // 3. Extract technical capitalized terms and acronyms from the Job Description (e.g. RAG, MLOps, ETL, CI/CD, PySpark)
  const acronyms = parsed.jobDescription.match(/\b[A-Z][A-Z0-9+#/.-]{1,8}\b/g) ?? [];
  for (const rawAcronym of acronyms) {
    const clean = cleanToken(rawAcronym).toUpperCase();
    if (clean.length >= 2 && clean.length <= 8 && !STOP_WORDS.has(clean.toLowerCase()) && !/^[#\d]+$/.test(clean)) {
      if (!targetSet.has(clean)) {
        targetSet.set(clean, clean.toLowerCase());
      }
    }
  }

  // 3b. Extract clean bulleted competencies or list items (e.g. "- Creative Thinking", "- Audience Engagement")
  const bulletLines = parsed.jobDescription.split(/\r?\n/)
    .map(line => line.replace(/^[-*•#\s\d.]+/, "").replace(/[#*_`~|]/g, "").trim())
    .filter(line => line.length >= 3 && line.length <= 40 && !/^(requirements|qualifications|competencies|responsibilities|experience|skills|about|summary|overview|key competencies|what you will do|who you are|responsibilities include)/i.test(line));
  for (const bullet of bulletLines) {
    const clean = cleanToken(bullet);
    if (clean.length >= 3 && clean.length <= 40 && !STOP_WORDS.has(clean.toLowerCase())) {
      const formatted = clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      if (!targetSet.has(formatted)) {
        targetSet.set(formatted, clean.toLowerCase());
      }
    }
  }

  // 4. Fallback if few technical skills were discovered: scan 2-word noun phrases per line (never across line boundaries)
  if (targetSet.size < 6) {
    const lines = parsed.jobDescription.replace(/[#*_`~|]/g, " ").split(/\r?\n/);
    for (const line of lines) {
      const words = line.toLowerCase().match(/[a-z0-9+]{3,}/g) ?? [];
      for (let i = 0; i < words.length - 1; i++) {
        const w1 = cleanToken(words[i]);
        const w2 = cleanToken(words[i + 1]);
        if (!STOP_WORDS.has(w1) && !STOP_WORDS.has(w2) && w1.length >= 3 && w2.length >= 3 && !/^\d+$/.test(w1) && !/^\d+$/.test(w2)) {
          const bigram = `${w1} ${w2}`;
          const formatted = `${w1.charAt(0).toUpperCase() + w1.slice(1)} ${w2.charAt(0).toUpperCase() + w2.slice(1)}`;
          if (!targetSet.has(formatted) && hasTerm(normalizedJob, bigram)) {
            targetSet.set(formatted, bigram);
            if (targetSet.size >= 12) break;
          }
        }
      }
      if (targetSet.size >= 12) break;
    }
  }

  // If still very sparse, add non-stopword tokens that appear >= 2 times
  if (targetSet.size < 5) {
    const wordCounts = new Map<string, number>();
    const cleanedText = parsed.jobDescription.replace(/[#*_`~|]/g, " ");
    const tokens = cleanedText.toLowerCase().match(/[a-z0-9+]{3,}/g) ?? [];
    for (const token of tokens) {
      const c = cleanToken(token);
      if (c.length >= 3 && !STOP_WORDS.has(c) && !/^\d+$/.test(c)) {
        wordCounts.set(c, (wordCounts.get(c) ?? 0) + 1);
      }
    }
    const sorted = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [w] of sorted) {
      const label = w.charAt(0).toUpperCase() + w.slice(1);
      if (!targetSet.has(label)) {
        targetSet.set(label, w);
        if (targetSet.size >= 10) break;
      }
    }
  }

  // Classify requirements into matched and missing
  const matched: string[] = [];
  const missing: string[] = [];

  for (const [canonical, searchKey] of targetSet.entries()) {
    // Check if the resume matches this requirement
    const isMatched = hasTerm(normalizedResume, searchKey) || hasTerm(normalizedResume, canonical.toLowerCase());
    if (isMatched) {
      matched.push(canonical);
    } else {
      missing.push(canonical);
    }
  }

  // Deduplicate and filter out any accidental overlap
  const finalMatched = Array.from(new Set(matched)).slice(0, 16);
  const finalMissing = Array.from(new Set(missing))
    .filter((m) => !finalMatched.some((match) => match.toLowerCase() === m.toLowerCase()))
    .slice(0, 16);

  const total = finalMatched.length + finalMissing.length;
  const matchRatio = total > 0 ? finalMatched.length / total : 0;

  // Realistic match score curve
  const rawScore = total > 0 ? Math.round(matchRatio * 90 + Math.min(10, finalMatched.length * 1.2)) : 0;
  const score = Math.min(100, Math.max(0, rawScore));

  const reliability = parsed.jobDescription.length >= 800 && total >= 8 ? "high" : parsed.jobDescription.length >= 400 ? "medium" : "low";

  const actions: string[] = [];
  if (finalMissing.length > 0) {
    actions.push(`Check the most important missing requirements: ${finalMissing.slice(0, 5).join(", ")}.`);
  } else {
    actions.push("Your resume strongly reflects the core technical requirements of this role.");
  }
  actions.push("Connect each skill to a quantified business achievement or engineering responsibility.");
  actions.push("Use the employer’s exact terminology only when it truthfully describes your direct experience.");

  return {
    score,
    reliability,
    matched: finalMatched,
    missing: finalMissing,
    transferable: [],
    actions,
    disclaimer: "This comparison is a guide, not a prediction of an employer’s decision.",
  };
}
