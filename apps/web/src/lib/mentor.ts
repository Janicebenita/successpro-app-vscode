import { z } from "zod";
export const mentorCategories = ["communication", "executive-coaching", "career-guidance", "interview-coaching", "resume-linkedin-coaching", "leadership", "personality-development", "technical-specialty", "industry-domain-expertise"] as const;
const slot = z.object({ day: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timeZone: z.string().trim().min(3).max(80) }).refine((value) => value.startTime < value.endTime, "End time must be after start time.");
export const mentorApplicationSchema = z.object({ displayName: z.string().trim().min(2).max(120), headline: z.string().trim().min(10).max(180), categories: z.array(z.enum(mentorCategories)).min(1).max(5), skills: z.array(z.string().trim().min(2).max(80)).min(1).max(20), experienceYears: z.number().int().min(2).max(60), mentoringExperience: z.string().trim().min(40).max(2_000), rateAmount: z.number().int().positive().max(1_000_000), currency: z.string().trim().regex(/^[A-Z]{3}$/), sessionMinutes: z.number().int().min(30).max(180), availability: z.array(slot).min(1).max(14), meetingMode: z.literal("external-link"), accuracyConfirmed: z.literal(true) });
export const mentorDecisionSchema = z.object({ status: z.enum(["approved", "rejected"]), reason: z.string().trim().min(20).max(1_000) });
export const mentorBookingSchema = z.object({ mentorId: z.string().min(3).max(128), scheduledStart: z.string().datetime(), customerNote: z.string().trim().max(1_000).default("") });
export const mentorBookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("set-meeting-link"), meetingUrl: z.string().url().max(500).refine((value) => value.startsWith("https://"), "Use a secure HTTPS meeting link.") }),
  z.object({ action: z.literal("confirm-completion") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(10).max(1_000) }),
  z.object({ action: z.literal("customer-no-show"), reason: z.string().trim().min(10).max(1_000) }),
  z.object({ action: z.literal("dispute"), reason: z.string().trim().min(20).max(2_000) }),
  z.object({ action: z.literal("review"), rating: z.number().int().min(1).max(5), review: z.string().trim().min(20).max(2_000) }),
]);
export function mentorLedgerAmounts(grossAmount: number, commissionBps = 2000) { const platformCommission = Math.round(grossAmount * commissionBps / 10_000); return { grossAmount, platformCommission, mentorEarning: grossAmount - platformCommission, commissionBps }; }
