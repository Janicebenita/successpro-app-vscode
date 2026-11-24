import { z } from "zod";

export function webUrlSchema(maxLength = 1_000) {
  return z.string().url().max(maxLength).refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  }, { message: "Use a complete http or https URL." });
}
