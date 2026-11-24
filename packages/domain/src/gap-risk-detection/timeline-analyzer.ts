import type { GapRiskFinding, TimelineGapDetail } from "./types";
import { extractEmploymentEntries, validateEmploymentDates } from "../successpro-v2/employment-validation";

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const endpoint = "(?:[A-Za-z]+\\.?(?:\\s*['’`]?\\s*\\d{2,4})|\\d{1,2}/\\d{2,4}|['’`]?\\d{2,4}|present|current|now)";
const rangePattern = new RegExp(`(${endpoint})\\s*(?:[–—-]|\\bto\\b)\\s*(${endpoint})`, "i");

function parseDateBound(raw: string, now: Date): { earliest: number; latest: number; precision: "month" | "year" } | null {
  const value = raw.trim().toLowerCase().replace(/[’`]/g, "'");
  if (/^(present|current|now)$/.test(value)) {
    const month = now.getUTCFullYear() * 12 + now.getUTCMonth();
    return { earliest: month, latest: month, precision: "month" };
  }
  const yearOnly = /^'?(\d{2}|\d{4})$/.exec(value);
  if (yearOnly) {
    const y = Number(yearOnly[1]);
    const year = y < 100 ? (y >= 50 ? 1900 + y : 2000 + y) : y;
    return { earliest: year * 12, latest: year * 12 + 11, precision: "year" };
  }
  const numeric = /^(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  const named = /^([a-z]+)\.?\s*'?\s*(\d{2}|\d{4})$/.exec(value);
  const month = numeric ? Number(numeric[1]) : named ? monthNames.indexOf(named[1].slice(0, 3)) + 1 : 0;
  if (month < 1 || month > 12 || (!numeric && !named)) return null;
  const rawYear = Number((numeric ?? named)![2]);
  const year = rawYear < 100 ? (rawYear >= 50 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  return { earliest: year * 12 + month - 1, latest: year * 12 + month - 1, precision: "month" };
}

function formatDuration(months: number): string {
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${rem} month${rem === 1 ? "" : "s"}`;
}

export function analyzeTimelineGaps(
  text: string,
  now = new Date()
): { findings: GapRiskFinding[]; timelineGaps: TimelineGapDetail[]; totalMonths: number } {
  const findings: GapRiskFinding[] = [];
  const timelineGaps: TimelineGapDetail[] = [];
  const rawEntries = extractEmploymentEntries(text);
  const validation = validateEmploymentDates(rawEntries, undefined, now);

  // 1. Process valid dated entries in chronological order
  const datedEntries: Array<{
    role: string;
    source: string;
    range: string;
    start: { earliest: number; latest: number };
    end: { earliest: number; latest: number };
  }> = [];

  for (const entry of rawEntries) {
    if (!entry.range) {
      findings.push({
        id: `timeline-missing-date-${findings.length + 1}`,
        title: `Missing Employment Dates for Role: ${entry.role}`,
        category: "timeline_gap",
        severity: "High",
        evidenceExcerpt: entry.source.slice(0, 200),
        explanation: `The position "${entry.role}" does not list start and end dates. Recruiter screeners and ATS systems require complete dates to verify work history.`,
        whyItMatters: "Missing dates prevent ATS software from calculating total experience and often lead recruiters to assume incomplete or unverified claims.",
        recommendedCorrection: `Add clear start and end dates (e.g. "Jun 2021 – Aug 2023" or "2021 – Present") directly below the "${entry.role}" title.`,
        confidence: "High",
        isMandatory: true,
      });
      continue;
    }

    const parts = entry.range.match(rangePattern);
    if (!parts) continue;
    const start = parseDateBound(parts[1], now);
    const end = parseDateBound(parts[2], now);
    if (!start || !end) continue;

    if (start.earliest > end.latest) {
      findings.push({
        id: `timeline-reversed-date-${findings.length + 1}`,
        title: `Reversed Employment Dates for: ${entry.role}`,
        category: "timeline_gap",
        severity: "Critical",
        evidenceExcerpt: entry.range,
        explanation: `The printed start date (${parts[1]}) is chronologically later than the printed end date (${parts[2]}).`,
        whyItMatters: "Reversed dates trigger immediate ATS parsing errors and create confusion during initial screening.",
        recommendedCorrection: `Correct the dates so the earlier date appears first (e.g., "${parts[2]} – ${parts[1]}").`,
        confidence: "High",
        isMandatory: true,
      });
      continue;
    }

    const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
    if (end.earliest > currentMonth && !/^(present|current|now)$/i.test(parts[2]) && !/\b(expected|projected|anticipated)\b/i.test(entry.source)) {
      findings.push({
        id: `timeline-future-date-${findings.length + 1}`,
        title: `Future Employment End Date: ${parts[2]} for ${entry.role}`,
        category: "contradiction",
        severity: "Critical",
        evidenceExcerpt: entry.range,
        explanation: `The position lists an end date (${parts[2]}) that is in the future. Past employment cannot have a future end date without indicating expected completion or present employment.`,
        whyItMatters: "Future end dates on non-current positions signal date calculation errors, contradictory timelines, or typographical mistakes that raise red flags during background checks.",
        recommendedCorrection: `Update the end date to reflect the actual completion date or use "Present" if you are currently working in this role.`,
        confidence: "High",
        isMandatory: true,
      });
      continue;
    }

    datedEntries.push({
      role: entry.role,
      source: entry.source,
      range: entry.range,
      start,
      end,
    });
  }

  // Sort chronological
  datedEntries.sort((a, b) => a.start.earliest - b.start.earliest);

  // 2. Identify Employment Gaps between consecutive roles
  for (let i = 0; i < datedEntries.length - 1; i++) {
    const prev = datedEntries[i];
    const next = datedEntries[i + 1];

    // Gap exists if next start > prev end + 1 month
    const gapMonths = next.start.earliest - prev.end.latest - 1;

    if (gapMonths >= 6) {
      const durationLabel = formatDuration(gapMonths);
      const severity = gapMonths >= 24 ? "High" : gapMonths >= 12 ? "Medium" : "Low";

      timelineGaps.push({
        previousRole: prev.role,
        nextRole: next.role,
        startDate: prev.range.split(/[–—-]|to/i)[1]?.trim() ?? "",
        endDate: next.range.split(/[–—-]|to/i)[0]?.trim() ?? "",
        durationMonths: gapMonths,
        durationLabel,
        severity,
        explanationRequired: gapMonths >= 12,
      });

      findings.push({
        id: `timeline-gap-${gapMonths}m-${findings.length + 1}`,
        title: `Employment Gap of ${durationLabel} (${prev.role} → ${next.role})`,
        category: "timeline_gap",
        severity,
        evidenceExcerpt: `${prev.role} (${prev.range})\n...\n${next.role} (${next.range})`,
        explanation: `There is a gap of approximately ${durationLabel} between ending "${prev.role}" and starting "${next.role}".`,
        whyItMatters: "Gaps are not inherently negative, but unexplained multi-month intervals prompt recruiter questions during technical screening. Documenting sabbaticals, continuous learning, freelance work, or family care preemptively builds trust.",
        recommendedCorrection: `If you engaged in freelance consulting, professional certifications, personal projects, or an intentional sabbatical during this period, add a brief 1-line note explaining it to prevent recruiter doubts.`,
        confidence: "High",
        isMandatory: false,
      });
    }
  }

  // 3. Identify Overlapping Roles
  for (let i = 0; i < datedEntries.length; i++) {
    for (let j = i + 1; j < datedEntries.length; j++) {
      const a = datedEntries[i];
      const b = datedEntries[j];
      const overlapMonths = Math.min(a.end.earliest, b.end.earliest) - Math.max(a.start.latest, b.start.latest) + 1;
      const isConcurrent = /\b(part[- ]time|freelance|concurrent|advisor|internship|intern)\b/i.test(a.source) ||
        /\b(part[- ]time|freelance|concurrent|advisor|internship|intern)\b/i.test(b.source);

      if (overlapMonths > 2 && !isConcurrent) {
        findings.push({
          id: `timeline-overlap-${findings.length + 1}`,
          title: `Overlapping Employment: ${a.role} and ${b.role}`,
          category: "timeline_gap",
          severity: "Medium",
          evidenceExcerpt: `${a.role} (${a.range}) overlaps with ${b.role} (${b.range})`,
          explanation: `Both positions are listed as active during the same time frame (${overlapMonths} months overlap) without a label clarifying concurrent or part-time work.`,
          whyItMatters: "Recruiters may question whether one role ended earlier or whether full-time dual employment occurred.",
          recommendedCorrection: `If one role was freelance, advisory, or part-time, add that tag (e.g. "Part-time" or "Consulting") to clarify concurrent dates.`,
          confidence: "Medium",
          isMandatory: false,
        });
      }
    }
  }

  // 4. Education to Employment Timeline
  const educationSection = text.match(/(?:education|academic\s+background)[\s\S]*?(?=(?:experience|skills|projects|certifications|$))/i)?.[0];
  if (educationSection && datedEntries.length > 0) {
    const allYears = Array.from(educationSection.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) => Number(m[1]));
    const gradYear = allYears.length ? Math.max(...allYears) : null;
    if (gradYear) {
      const firstJobStartYear = Math.floor(datedEntries[0].start.earliest / 12);
      if (firstJobStartYear - gradYear >= 2 && firstJobStartYear <= now.getUTCFullYear()) {
        const postGradGapYears = firstJobStartYear - gradYear;
        findings.push({
          id: `timeline-postgrad-gap-${findings.length + 1}`,
          title: `Unexplained Gap of ~${postGradGapYears} Years Between Graduation and First Role`,
          category: "timeline_gap",
          severity: "Low",
          evidenceExcerpt: `Graduation year: ${gradYear} → First role starts: ${firstJobStartYear} (${datedEntries[0].role})`,
          explanation: `There is a gap of approximately ${postGradGapYears} years between your graduation in ${gradYear} and your first listed professional position in ${firstJobStartYear}.`,
          whyItMatters: "Recruiters reviewing early-career trajectory may ask about initial postgraduate training, internships, or academic projects.",
          recommendedCorrection: "If you completed internships, graduate research, or freelance projects during this period, list them briefly to show continuous activity.",
          confidence: "Medium",
          isMandatory: false,
        });
      }
    }
  }

  const totalMonths = validation.durationMonths ? Math.round((validation.durationMonths[0] + validation.durationMonths[1]) / 2) : 0;

  return { findings, timelineGaps, totalMonths };
}
