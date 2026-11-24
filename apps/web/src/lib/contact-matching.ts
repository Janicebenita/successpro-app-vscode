import { createHash } from "node:crypto";
import { z } from "zod";
export const contactMatchSchema = z.object({ emails: z.array(z.string().email().max(254)).min(1).max(100), consent: z.literal(true) });
export function normalizedContactHash(email: string) { return createHash("sha256").update(email.normalize("NFKC").trim().toLowerCase(), "utf8").digest("hex"); }
export function uniqueContactHashes(emails: string[]) { return [...new Set(emails.map(normalizedContactHash))]; }
