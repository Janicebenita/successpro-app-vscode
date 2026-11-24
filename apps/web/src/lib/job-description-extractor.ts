import { cleanExtractedText } from "./resume-extraction";

export interface ExtractedJobPosting {
  title: string;
  company: string;
  location: string;
  employmentType?: string;
  text: string;
  method: "json-ld" | "linkedin-container" | "indeed-container" | "html-container" | "html-full";
}

function unescapeHtml(text: string): string {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&bull;/g, "•");
}

export function cleanHtmlToText(html: string): string {
  return cleanExtractedText(
    unescapeHtml(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li|h[1-6]|section|article|tr)>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "\n• ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function formatLocation(loc: unknown): string {
  if (!loc) return "";
  if (typeof loc === "string") return loc;
  if (Array.isArray(loc)) return loc.map(formatLocation).filter((s) => s && s !== "[object Object]").join("; ");
  if (typeof loc === "object" && loc !== null) {
    const obj = loc as Record<string, unknown>;
    if (obj.address) {
      const addr = obj.address;
      if (typeof addr === "string") return addr;
      if (typeof addr === "object" && addr !== null) {
        const a = addr as Record<string, unknown>;
        const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
        return parts.join(", ");
      }
    }
    const candidate = obj.name || obj.city || obj.location || obj.label;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    const parts = [obj.addressLocality, obj.addressRegion, obj.addressCountry].filter(Boolean);
    if (parts.length) return parts.join(", ");
    return "";
  }
  return "";
}

function extractMeta(html: string, propertyOrName: string): string {
  const regex = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${propertyOrName}["'][^>]*content=["']([^"']+)["']`, "i");
  const match = html.match(regex);
  if (match) return unescapeHtml(match[1].trim());
  const altRegex = new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${propertyOrName}["']`, "i");
  const altMatch = html.match(altRegex);
  return altMatch ? unescapeHtml(altMatch[1].trim()) : "";
}

/**
 * Removes surrounding navigation, recommendations ("Similar jobs", "People also viewed",
 * "Similar searches"), and sign-in headers that are not part of the job description.
 */
function stripSurroundingJobPageNoise(text: string): string {
  let cleaned = text;

  // 1. Truncate trailing recommendations / footer noise
  const cutoffRegex = /\n(?:Similar jobs|People also viewed|Similar searches|Similar Searches|Explore top content|Recommended jobs|More jobs like this|Jobs you might like|Jobs similar to|Sign in to create job alert|Explore similar jobs)[\s\S]*$/i;
  cleaned = cleaned.replace(cutoffRegex, "");

  // 2. Strip leading login / auth prompt noise
  const authPromptRegex = /^(?:Join or sign in to find your next job|Sign in to apply|Join to apply|Join now|Email or phone|Password|Forgot password|By clicking Continue to join or sign in|Sign in with Email|New to LinkedIn\?[\s\S]*?Join now)[\s\S]*?(?=\n(?:Role|Project Role|Job Description|About the (?:role|job)|Summary|The opportunity|Who we are|Responsibilities|Requirements|Qualifications)|\n{2,})/i;
  cleaned = cleaned.replace(authPromptRegex, "");

  return cleanExtractedText(cleaned);
}

/**
 * Extracts job description details from HTML using structured data (schema.org/JobPosting JSON-LD)
 * when available, with intelligent HTML parsing fallback for LinkedIn, Indeed, Workday, etc.
 */
export function extractJobPostingFromHtml(html: string, pageUrl = ""): ExtractedJobPosting | null {
  if (!html || typeof html !== "string") return null;

  // 1. JSON-LD Extraction (schema.org/JobPosting)
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1].trim());
      const candidates: Record<string, unknown>[] = [];
      if (Array.isArray(raw)) candidates.push(...raw);
      else if (raw && Array.isArray(raw["@graph"])) candidates.push(...raw["@graph"]);
      else if (raw && typeof raw === "object") candidates.push(raw);

      for (const item of candidates) {
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (types.some((t) => typeof t === "string" && t.toLowerCase() === "jobposting")) {
          const title = String(item.title ?? "").trim();
          const hiringOrg = item.hiringOrganization as Record<string, unknown> | string | undefined;
          const company = typeof hiringOrg === "object" && hiringOrg !== null
            ? String(hiringOrg.name ?? "").trim()
            : typeof hiringOrg === "string" ? hiringOrg.trim() : "";
          const loc = formatLocation(item.jobLocation);
          const isRemote = item.jobLocationType === "TELECOMMUTE" || /remote/i.test(String((item.applicantLocationRequirements as Record<string, unknown>)?.name || ""));
          const location = [loc, isRemote ? "(Remote)" : ""].filter(Boolean).join(" ");
          const descHtml = String(item.description ?? "");
          const descText = stripSurroundingJobPageNoise(cleanHtmlToText(descHtml));

          if (descText.length >= 80) {
            const sections: string[] = [];
            if (title) sections.push(`Role: ${title}`);
            if (company) sections.push(`Company: ${company}`);
            if (location) sections.push(`Location: ${location}`);
            if (item.employmentType) {
              const empType = Array.isArray(item.employmentType) ? item.employmentType.join(", ") : String(item.employmentType);
              sections.push(`Employment Type: ${empType}`);
            }
            sections.push(`\nJob Description:\n${descText}`);

            if (item.responsibilities) {
              const resp = Array.isArray(item.responsibilities) ? item.responsibilities.join("\n• ") : String(item.responsibilities);
              sections.push(`\nResponsibilities:\n${cleanHtmlToText(resp)}`);
            }
            if (item.qualifications || item.experienceRequirements) {
              const qual = item.qualifications ?? item.experienceRequirements;
              const qualText = Array.isArray(qual) ? qual.join("\n• ") : String(qual);
              sections.push(`\nQualifications & Requirements:\n${cleanHtmlToText(qualText)}`);
            }
            if (item.skills) {
              const skills = Array.isArray(item.skills) ? item.skills.join(", ") : String(item.skills);
              sections.push(`\nRequired Skills: ${skills}`);
            }

            return {
              title,
              company,
              location,
              employmentType: typeof item.employmentType === "string" ? item.employmentType : undefined,
              text: sections.join("\n").slice(0, 50_000),
              method: "json-ld"
            };
          }
        }
      }
    } catch {
      // Continue searching next JSON-LD block
    }
  }

  // 2. LinkedIn Public Job Postings
  if (/linkedin\.com\/jobs/i.test(pageUrl) || html.includes("show-more-less-html__markup")) {
    const titleMatch = html.match(/<(?:h1|h2)\b[^>]*class=["'][^"']*top-card-layout__title[^"']*["'][^>]*>([\s\S]*?)<\/(?:h1|h2)>/i)
      || html.match(/<(?:h1|h2)\b[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i);
    const title = titleMatch ? cleanHtmlToText(titleMatch[1]) : "";

    const compMatch = html.match(/<a\b[^>]*class=["'][^"']*topcard__org-name-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      || html.match(/class=["'][^"']*topcard__flavor[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|a)>/i);
    const company = compMatch ? cleanHtmlToText(compMatch[1]) : "";

    const locMatch = html.match(/class=["'][^"']*topcard__flavor--bullet[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const location = locMatch ? cleanHtmlToText(locMatch[1]) : "";

    // The core job description container in LinkedIn
    const markupIdx = html.indexOf("show-more-less-html__markup");
    if (markupIdx !== -1) {
      const startIdx = html.indexOf(">", markupIdx) + 1;
      const endBtnIdx = html.indexOf("<button", startIdx);
      const endSectionIdx = html.indexOf("</section>", startIdx);
      const endIdx = endBtnIdx !== -1 ? endBtnIdx : endSectionIdx !== -1 ? endSectionIdx : startIdx + 8000;
      const rawMarkup = html.slice(startIdx, endIdx);
      const cleanDesc = stripSurroundingJobPageNoise(cleanHtmlToText(rawMarkup)).replace(/<[^>]*$/g, "").trim();

      if (cleanDesc.length >= 80) {
        const sections: string[] = [];
        if (title) sections.push(`Role: ${title}`);
        if (company) sections.push(`Company: ${company}`);
        if (location) sections.push(`Location: ${location}`);
        sections.push(`\nJob Description:\n${cleanDesc}`);

        return {
          title,
          company,
          location,
          text: sections.join("\n").slice(0, 50_000),
          method: "linkedin-container"
        };
      }
    }
  }

  // 3. Indeed Job Postings
  if (/indeed\.com/i.test(pageUrl) || html.includes("jobDescriptionText")) {
    const indeedMatch = html.match(/id=["']jobDescriptionText["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    if (indeedMatch) {
      const cleanDesc = stripSurroundingJobPageNoise(cleanHtmlToText(indeedMatch[1]));
      if (cleanDesc.length >= 80) {
        const title = extractMeta(html, "og:title") || (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ? cleanHtmlToText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)![1]) : "");
        const company = extractMeta(html, "og:site_name") || "";
        const sections: string[] = [];
        if (title) sections.push(`Role: ${title}`);
        if (company) sections.push(`Company: ${company}`);
        sections.push(`\nJob Description:\n${cleanDesc}`);
        return {
          title,
          company,
          location: "",
          text: sections.join("\n").slice(0, 50_000),
          method: "indeed-container"
        };
      }
    }
  }

  // 4. Naukri Job Postings (naukri.com)
  if (/naukri\.com/i.test(pageUrl) || html.includes("job-desc-container") || html.includes("dang-inner-html") || html.includes("__INITIAL_STATE__")) {
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i) ||
      html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const job = state.jobDetails || state.jobData || state.jdData;
        if (job) {
          const title = String(job.title || job.jobTitle || "").trim();
          const company = String(job.companyDetail?.name || job.companyName || "").trim();
          const location = String(job.location || job.jobLocation || "").trim();
          const rawDesc = String(job.jobDescription || job.description || "");
          const descText = stripSurroundingJobPageNoise(cleanHtmlToText(rawDesc));
          const skills = Array.isArray(job.keySkills) ? job.keySkills.map((s: any) => typeof s === "string" ? s : s?.name).filter(Boolean).join(", ") : "";
          if (descText.length >= 50) {
            const sections: string[] = [];
            if (title) sections.push(`Role: ${title}`);
            if (company) sections.push(`Company: ${company}`);
            if (location) sections.push(`Location: ${location}`);
            sections.push(`\nJob Description:\n${descText}`);
            if (skills) sections.push(`\nRequired Skills: ${skills}`);
            return {
              title,
              company,
              location,
              text: sections.join("\n").slice(0, 50_000),
              method: "html-container"
            };
          }
        }
      } catch {}
    }

    const naukriDomMatch = html.match(/(?:class=["'][^"']*(?:dang-inner-html|job-desc|styles_job-desc|styles_JDC)[^"']*)[^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    if (naukriDomMatch) {
      const cleanDesc = stripSurroundingJobPageNoise(cleanHtmlToText(naukriDomMatch[1]));
      if (cleanDesc.length >= 50) {
        const title = extractMeta(html, "og:title") || (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ? cleanHtmlToText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)![1]) : "");
        const company = extractMeta(html, "og:site_name") || "";
        const sections: string[] = [];
        if (title) sections.push(`Role: ${title}`);
        if (company) sections.push(`Company: ${company}`);
        sections.push(`\nJob Description:\n${cleanDesc}`);
        return {
          title,
          company,
          location: "",
          text: sections.join("\n").slice(0, 50_000),
          method: "html-container"
        };
      }
    }
  }

  // 5. Phenom People Career Sites (Caterpillar, etc.)
  if (html.includes("phApp") || /careers\.[a-z0-9-]+\.com/i.test(pageUrl)) {
    const phMatch = html.match(/(?:window\.)?phApp\s*=\s*({[\s\S]*?});\s*<\/script>/i) ||
      html.match(/(?:window\.)?phApp\.ddo\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (phMatch) {
      try {
        const ph = JSON.parse(phMatch[1]);
        const job = ph.jobDetail || ph.ddo?.jobDetail || ph.job;
        if (job) {
          const title = String(job.title || job.jobTitle || "").trim();
          const company = String(job.company || job.companyName || "Caterpillar").trim();
          const location = String(job.location || job.primaryLocation || "").trim();
          const rawDesc = String(job.description || job.jobDescription || "");
          const descText = stripSurroundingJobPageNoise(cleanHtmlToText(rawDesc));
          if (descText.length >= 60) {
            const sections: string[] = [];
            if (title) sections.push(`Role: ${title}`);
            if (company) sections.push(`Company: ${company}`);
            if (location) sections.push(`Location: ${location}`);
            sections.push(`\nJob Description:\n${descText}`);
            return {
              title,
              company,
              location,
              text: sections.join("\n").slice(0, 50_000),
              method: "html-container"
            };
          }
        }
      } catch {}
    }
  }

  // 6. Targeted Container Extraction (Workday, SmartRecruiters, Taleo, etc.)
  const containerMatches = [
    /<(?:div|section|article)[^>]*(?:data-automation-id=["']jobPostingDescription["']|class=["'][^"']*(?:job-description|jobDescription|job-details|role-description|posting-page)[^"']*)[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const regex of containerMatches) {
    const cMatch = html.match(regex);
    if (cMatch && cMatch[1]) {
      const containerText = stripSurroundingJobPageNoise(cleanHtmlToText(cMatch[1]));
      if (containerText.length >= 100) {
        const title = extractMeta(html, "og:title") || (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ? cleanHtmlToText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)![1]) : "");
        const company = extractMeta(html, "og:site_name") || extractMeta(html, "author") || "";
        const heading = [title ? `Role: ${title}` : "", company ? `Company: ${company}` : ""].filter(Boolean).join("\n");
        return {
          title,
          company,
          location: "",
          text: (heading ? `${heading}\n\n` : "") + containerText.slice(0, 50_000),
          method: "html-container"
        };
      }
    }
  }

  // 7. Full Document HTML Text Fallback with Noise Stripping
  const fullText = stripSurroundingJobPageNoise(cleanHtmlToText(html));
  if (fullText.length >= 120) {
    const title = extractMeta(html, "og:title") || (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ? cleanHtmlToText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)![1]) : "");
    const company = extractMeta(html, "og:site_name") || "";
    const heading = [title ? `Role: ${title}` : "", company ? `Company: ${company}` : ""].filter(Boolean).join("\n");
    return {
      title,
      company,
      location: "",
      text: (heading ? `${heading}\n\n` : "") + fullText.slice(0, 50_000),
      method: "html-full"
    };
  }

  return null;
}
