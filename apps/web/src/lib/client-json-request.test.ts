import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithDeadline } from "./client-json-request";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("workspace JSON failure recovery", () => {
  it("preserves JSON success and ordinary API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Add a location" }, { status: 400 })));
    const response = await fetchJsonWithDeadline("/api/test");
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "Add a location" });
  });
  it("turns network failure into a visible retry message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const response = await fetchJsonWithDeadline("/api/test");
    expect(response.status).toBe(503); expect((await response.json()).error).toMatch(/try again/i);
  });
  it("recovers when the proxy returns non-JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Error</html>", { status: 502 })));
    expect((await fetchJsonWithDeadline("/api/test")).status).toBe(503);
  });
  it("aborts a stalled connection and clears its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => { init.signal.addEventListener("abort", () => reject(new Error("aborted"))); })));
    const pending = fetchJsonWithDeadline("/api/test", {}, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const response = await pending;
    expect((await response.json()).error).toMatch(/longer than expected/i); expect(vi.getTimerCount()).toBe(0);
  });
});
