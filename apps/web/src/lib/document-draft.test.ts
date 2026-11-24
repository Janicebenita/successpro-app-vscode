import { expect, it } from "vitest";
import { documentDraftSchema } from "./document-draft";

it("strips Firestore metadata before a saved draft reaches the client", () => {
  const timestamp = { toDate: () => new Date() };
  const parsed = documentDraftSchema.parse({
    templateId: "clarity", pageSize: "a4",
    contact: { email: "candidate@example.com", phone: "", location: "", linkedIn: "", website: "" },
    role: "Product Director", company: "Example", focus: "", jobDescription: "", tone: "direct",
    recipientName: "", recipientTitle: "", companyAddress: "", letterText: "A tailored letter.",
    updatedAt: timestamp, id: "draft-1", ownerId: "candidate-1", schemaVersion: 1,
  });
  expect(parsed).not.toHaveProperty("updatedAt");
  expect(parsed).not.toHaveProperty("ownerId");
  expect(parsed.letterText).toBe("A tailored letter.");
});
