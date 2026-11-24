import type {
  ActionEffort,
  ActionPriority,
  PaidActionItem,
  PaidTierReport,
  ParameterEvaluationResult,
} from "./types";

interface ActionRuleMetadata {
  priority: ActionPriority;
  effort: ActionEffort;
  likelyEffect: string;
  howToCorrect: string;
}

const PAID_METADATA_BY_ID: Record<string, ActionRuleMetadata> = {
  C01: {
    priority: "P1",
    effort: "S",
    likelyEffect: "A reviewer may struggle to see the intended role or overlook relevant strengths.",
    howToCorrect: "Use a concise headline, opening evidence or optional summary that states function and genuine strengths; remove unsupported adjectives.",
  },
  C02: {
    priority: "P1",
    effort: "M",
    likelyEffect: "Duties or titles alone may not demonstrate readiness or seniority.",
    howToCorrect: "Describe the relevant task/problem, personal action, method and scope. Use projects, apprenticeships, trade work or community contribution for entrants; show decisions/depth for senior roles.",
  },
  C03: {
    priority: "P1",
    effort: "M",
    likelyEffect: "The resume may communicate effort without explaining its benefit.",
    howToCorrect: "Add the actual output, adoption, service improvement, quality change or verified metric. Describe team attribution accurately; use permitted qualitative evidence when numbers are unavailable.",
  },
  C04: {
    priority: "P1",
    effort: "S",
    likelyEffect: "Generic or unsupported skill claims may leave capability uncertain.",
    howToCorrect: "Group relevant skills, remove unsupported levels and connect key skills to genuine application. Use accurate terminology and explain unfamiliar acronyms.",
  },
  C05: {
    priority: "P1",
    effort: "S",
    likelyEffect: "A reviewer may misunderstand qualification status or need to clarify eligibility.",
    howToCorrect: "State the true qualification, provider/institution and completion/status; distinguish courses from licences. Use accepted equivalents; never claim renewal/completion without confirmation.",
  },
  C06: {
    priority: "P0",
    effort: "S",
    likelyEffect: "Recruiters may be unable to follow up or understand entries.",
    howToCorrect: "Show a chosen/professional name and a clear email or phone; complete genuinely missing context. Confirm delivery privately; do not require street address or sensitive details.",
  },
  C07: {
    priority: "P2",
    effort: "S",
    likelyEffect: "Useful experience may be harder to understand or take longer to review.",
    howToCorrect: "Clarify action and object, remove filler, correct verified errors and retain proper nouns/regional variants. Do not turn assisted into led without evidence.",
  },
  C08: {
    priority: "P2",
    effort: "S",
    likelyEffect: "The reviewer may need to reconstruct history or clarify conflicting claims.",
    howToCorrect: "Verify contradictions, standardize date conventions where useful and label concurrent/contract work if needed. Break explanations remain optional; never infer private reasons.",
  },
  C09: {
    priority: "P2",
    effort: "M",
    likelyEffect: "Relevant strengths can be buried in unrelated history or repeated information.",
    howToCorrect: "Promote relevant evidence and compress low-value repetition/older detail. Retain earlier relevant achievements and all required prescribed history.",
  },
  V01: {
    priority: "P2",
    effort: "S",
    likelyEffect: "Important qualifications may be missed or take unnecessary effort to locate.",
    howToCorrect: "Use clear text headings and consistent entry groups; order evidence by relevance. Education/projects-first is valid for many freshers.",
  },
  V02: {
    priority: "P1",
    effort: "S",
    likelyEffect: "A reviewer may skip small text or miss details.",
    howToCorrect: "Increase small text, use readable type and inspect the actual export. Approximately 10–12 pt body text is a starting point, not a fixed scoring cutoff.",
  },
  V03: {
    priority: "P2",
    effort: "S",
    likelyEffect: "Crowded or disconnected content may be harder to interpret.",
    howToCorrect: "Use consistent paragraph spacing and alignment; remove collisions and excessive gaps; keep related text grouped.",
  },
  V04: {
    priority: "P3",
    effort: "S",
    likelyEffect: "Inconsistent emphasis can distract attention from important facts.",
    howToCorrect: "Apply a small reusable style set and remove distracting ornamentation while preserving appropriate creative identity.",
  },
  V05: {
    priority: "P2",
    effort: "M",
    likelyEffect: "Detached headings or overcompression can cause evidence to be missed.",
    howToCorrect: "Fix page breaks and export settings; keep headings with entries. Reduce low-value repetition where present; allow longer senior, academic or prescribed CVs.",
  },
  V06: {
    priority: "P2",
    effort: "S",
    likelyEffect: "Some readers may lose information hidden in faint text or unexplained symbols.",
    howToCorrect: "Improve contrast and label essential icons/graphics with text; keep graphics supplementary. WCAG contrast ratios are useful guidance, not a resume certification.",
  },
  J01: {
    priority: "P1",
    effort: "M",
    likelyEffect: "The reviewer may not see readiness for the core duties.",
    howToCorrect: "Select genuine examples matching the important duties; retain accurate past titles and explain transferable functions.",
  },
  J02: {
    priority: "P1",
    effort: "M",
    likelyEffect: "Essential skills may appear unsupported even when the applicant possesses them.",
    howToCorrect: "Add truthful contextual examples for existing capabilities; list genuine skill-development gaps separately. Do not insert skills the person does not have.",
  },
  J03: {
    priority: "P1",
    effort: "M",
    likelyEffect: "The role level may look unsupported or relevant experience may be underestimated.",
    howToCorrect: "Clarify real scope and relevant dates, acknowledge uncertainty, and explain legitimate transferable responsibility; never inflate seniority or years.",
  },
  J04: {
    priority: "P0",
    effort: "L",
    likelyEffect: "A confirmed unmet mandatory condition may block progression; missing resume evidence alone does not prove ineligibility.",
    howToCorrect: "State true status and accepted equivalents; distinguish wording gaps from actual qualification gaps. Renewal/learning/alternative roles may be needed; rewriting cannot create eligibility.",
  },
  J05: {
    priority: "P2",
    effort: "S",
    likelyEffect: "Optional gaps may reduce differentiation; they do not automatically make someone ineligible.",
    howToCorrect: "Highlight real preferred/domain evidence after core essentials; explain transferability and label genuinely missing capabilities honestly.",
  },
};

/**
 * Rule 21: Priority and effort
 * P0: confirmed application/contact/ingestion blocker.
 * P1: important substance or mandatory-fit issue.
 * P2: clarity/navigation.
 * P3: polish.
 * User effort: S < 15 min, M 15–60 min, L > 60 min.
 * Conditional point recovery = effective max * (5 - rating) / 5.
 */
export function generatePaidReport(parameters: ParameterEvaluationResult[]): PaidTierReport {
  const actionPlan: PaidActionItem[] = [];
  const groups=new Map<string,PaidActionItem>();
  const seen=new Set<string>();
  // Workbook effort bands; planning denominators are documented estimates, never score weights.
  const effortMinutes={S:15,M:60,L:120};
  const priorityOrder: Record<ActionPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

  for (const param of parameters) {
    if (param.status !== "Assessed" || param.rating === null || param.rating >= 5) {
      continue;
    }
    if(seen.has(param.id))continue;
    seen.add(param.id);

    const meta = PAID_METADATA_BY_ID[param.id] || {
      priority: "P2" as ActionPriority,
      effort: "S" as ActionEffort,
      likelyEffect: "Evidence may be harder for reviewers to interpret.",
      howToCorrect: "Clarify evidence and connect to actual outcomes.",
    };

    // If an issue is flagged as a mandatory gap or contact blocker, promote to P0
    const hasBlocker = param.issues.some((i) => i.confirmedBlocker === true);
    const priority = hasBlocker ? "P0" : (meta.priority === "P0" ? "P1" : meta.priority);

    const conditionalPointRecovery = param.effectiveMaxWeight * ((5 - param.rating) / 5);
    const cause=param.issues.find(issue=>issue.rootCause && [param.evidence.excerpt,...(param.evidence.additionalExcerpts ?? []).map(e=>e.excerpt)].some(quote=>quote.includes(issue.rootCause!.sourceExcerpt)))?.rootCause;
    const groupKey=cause ? `${cause.key.toLowerCase().trim()}\n${cause.sourceExcerpt}` : param.id;
    const existing=groups.get(groupKey);
    if(existing){
      existing.affectedCriteria!.push({parameterId:param.id,conditionalPointRecovery});
      existing.conditionalPointRecovery+=conditionalPointRecovery;
      if(priorityOrder[priority]<priorityOrder[existing.priority])existing.priority=priority;
      if(effortMinutes[meta.effort]>effortMinutes[existing.effort])existing.effort=meta.effort;
      existing.effortMinutes=effortMinutes[existing.effort];
      existing.impactEffortRatio=existing.conditionalPointRecovery/existing.effortMinutes;
      continue;
    }

    const originalLine = param.pillar === "visual" ? undefined
      : cause?.sourceExcerpt || param.evidence.excerpt.trim() || undefined;

    const action:PaidActionItem={
      parameterId: param.id,
      priority,
      effort: meta.effort,
      issue: param.issues[0]?.message || param.anchorComparison?.nextAnchorGap || param.evidence.rationale,
      likelyEffect: meta.likelyEffect,
      howToCorrect: cause?.correction ?? meta.howToCorrect,
      rewriteTemplate: "",
      conditionalPointRecovery,
      affectedCriteria:[{parameterId:param.id,conditionalPointRecovery}],
      rootCause:cause?.key,
      effortMinutes:effortMinutes[meta.effort],
      impactEffortRatio:conditionalPointRecovery/effortMinutes[meta.effort],
      originalLine,
    };
    actionPlan.push(action);groups.set(groupKey,action);
  }

  // Sort by priority (P0 first, then P1, P2, P3), then by point recovery descending
  actionPlan.sort((a, b) => {
    // Confirmed blockers first. Other actions rank by conditional impact per effort.
    if((a.priority==="P0") !== (b.priority==="P0"))return a.priority==="P0" ? -1 : 1;
    return (b.impactEffortRatio ?? 0)-(a.impactEffortRatio ?? 0) || priorityOrder[a.priority]-priorityOrder[b.priority] || a.parameterId.localeCompare(b.parameterId);
  });

  return {
    actionPlan,
    prioritiesSummary: {
      p0Count: actionPlan.filter((a) => a.priority === "P0").length,
      p1Count: actionPlan.filter((a) => a.priority === "P1").length,
      p2Count: actionPlan.filter((a) => a.priority === "P2").length,
      p3Count: actionPlan.filter((a) => a.priority === "P3").length,
    },
  };
}
