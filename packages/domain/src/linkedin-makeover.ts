import type { CanonicalProfile } from "@successpro/contracts";

export type LinkedInMakeover = {
  headlines: string[];
  about: string;
  experience: Array<{ title: string; employer: string; dates: string; copy: string }>;
  prioritySkills: string[];
  featuredSuggestions: string[];
  credentials: string[];
  projects: string[];
  education: string[];
  recommendationPrompts: string[];
  searchKeywords: string[];
  visibilityChecklist: string[];
};

function sentence(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean && !/[.!?]$/.test(clean) ? `${clean}.` : clean;
}

export function createLinkedInMakeover(profile: CanonicalProfile): LinkedInMakeover {
  const strongestSkills = profile.skills.slice(0, 8);
  const target = profile.targetRoles[0];
  const role = profile.currentRole || profile.experience[0]?.title || profile.headline;
  const proof = profile.experience.flatMap((item) => item.achievements).slice(0, 3);
  const positioning = [role, strongestSkills.slice(0, 2).join(" & "), target ? `Open to ${target} opportunities` : "Focused on measurable customer and business outcomes"].filter(Boolean);
  const headlines = [
    positioning.join(" | ").slice(0, 220),
    [role, profile.industry, strongestSkills.slice(0, 3).join(" • ")].filter(Boolean).join(" | ").slice(0, 220),
    [target ? `${target} candidate` : role, proof[0] ? sentence(proof[0]).replace(/[.!?]$/, "") : profile.headline].filter(Boolean).join(" | ").slice(0, 220),
  ].filter((value, index, values) => value.length >= 2 && values.indexOf(value) === index);

  const aboutParts = [sentence(profile.summary), strongestSkills.length ? `My core strengths include ${strongestSkills.slice(0, 6).join(", ")}.` : "", proof.length ? `Selected outcomes: ${proof.map(sentence).join(" ")}` : "", target ? `I am interested in opportunities where I can contribute as a ${target}.` : ""].filter(Boolean);

  return {
    headlines,
    about: aboutParts.join("\n\n"),
    experience: profile.experience.map((item) => ({ title: item.title, employer: item.employer, dates: [item.startDate, item.endDate].filter(Boolean).join(" - "), copy: item.achievements.map((achievement) => `• ${sentence(achievement)}`).join("\n") })),
    prioritySkills: strongestSkills,
    featuredSuggestions: [
      ...profile.projects.slice(0, 3).map((item) => `${item.name}: ${item.description || "Add a short explanation of your contribution and the result."}`),
      ...profile.publications.slice(0, 2).map((item) => `${item.title}${item.publisher ? ` - ${item.publisher}` : ""}`),
      ...(profile.projects.length || profile.publications.length ? [] : ["Add one work sample, case study, presentation, or public project that demonstrates your strongest relevant skill."]),
    ],
    credentials: profile.certifications.map((item) => [item.name, item.issuer, item.date].filter(Boolean).join(" | ")),
    projects: profile.projects.map((item) => [item.name, item.description].filter(Boolean).join(" - ")),
    education: profile.education.map((item) => [item.qualification, item.institution, [item.startDate, item.endDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | ")),
    recommendationPrompts: [
      `Ask a recent manager to describe your contribution to ${proof[0] ? `this outcome: “${proof[0]}”` : "a measurable team or customer outcome"}.`,
      `Ask a cross-functional colleague to comment on how you apply ${strongestSkills[0] || "your strongest professional skill"} in practice.`,
      "Offer to write a recommendation for someone you know well; keep both recommendations specific, truthful, and independent.",
    ],
    searchKeywords: [...new Set([role, target, profile.industry, ...strongestSkills].filter(Boolean))].slice(0, 15) as string[],
    visibilityChecklist: [
      "Use a clear, current photograph only if you are comfortable doing so.",
      "Set a custom public profile URL and check how the page appears while signed out.",
      "Choose whether recruiters may see that you are open to work; the recruiter-only setting is less public but is not a guarantee of confidentiality.",
      "Review email, phone, birthday, connections, and activity visibility before publishing changes.",
      "Do not paste confidential employer, customer, revenue, security, or personal information into public sections.",
    ],
  };
}
