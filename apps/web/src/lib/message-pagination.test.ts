import { describe, expect, it } from "vitest";
import { messagePage } from "./message-pagination";

describe("message pagination", () => {
  it("returns a cursor only when another bounded page exists", () => {
    const documents = Array.from({ length: 51 }, (_, index) => ({ id: `message-${index + 1}` }));
    expect(messagePage(documents)).toEqual({ page: documents.slice(0, 50), nextCursor: "message-50" });
    expect(messagePage(documents.slice(0, 50))).toEqual({ page: documents.slice(0, 50), nextCursor: null });
  });
});
