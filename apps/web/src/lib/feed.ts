import { z } from "zod";

export const feedEventInputSchema = z.object({
  category: z.enum(["new-role", "certification", "career-milestone", "goal-progress", "award"]),
  title: z.string().trim().min(3).max(160),
  details: z.string().trim().min(10).max(1_500),
});
export const feedReactionSchema = z.object({ reaction: z.enum(["celebrate", "support", "insightful"]) });
export const feedReportSchema = z.object({ reason: z.enum(["spam", "harassment", "misinformation", "privacy", "other"]), details: z.string().trim().max(1_000).default("") }).refine((value) => value.reason !== "other" || value.details.length >= 10, { message: "Add a short explanation for other reports." });

export function chronologicalFeed<T extends { createdAtMs: number }>(events: T[], limit = 100) { return [...events].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, limit); }
