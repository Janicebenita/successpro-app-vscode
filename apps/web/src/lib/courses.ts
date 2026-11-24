import { courseCatalogEntrySchema, type CourseCatalogEntry } from "@successpro/contracts/learning";
import { adminDb } from "./firebase-admin";
import { courseCatalog } from "./course-catalog";

export async function activeCourseCatalog(): Promise<CourseCatalogEntry[]> {
  const builtIn = courseCatalog.map((course) => courseCatalogEntrySchema.parse(course));
  const snapshot = await adminDb.collection("courses").limit(500).get().catch(() => null);
  if (!snapshot || snapshot.empty) return builtIn;
  const merged = new Map(builtIn.map((course) => [course.id, course]));
  for (const document of snapshot.docs) {
    if (document.data().active !== true) { merged.delete(document.id); continue; }
    const parsed = courseCatalogEntrySchema.safeParse({ id: document.id, ...document.data() });
    if (parsed.success) merged.set(document.id, parsed.data);
  }
  return [...merged.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title));
}
