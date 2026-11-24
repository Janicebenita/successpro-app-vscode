import { z } from "zod";

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
});

export function parsePublicEnvironment(input: Record<string, string | undefined>) {
  return publicEnvironmentSchema.parse(input);
}
