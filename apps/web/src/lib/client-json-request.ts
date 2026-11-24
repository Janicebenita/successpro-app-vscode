// JSON workspace calls must always settle into a customer-visible state, even
// if the connection fails or an intermediary sends HTML instead of JSON.
export async function fetchJsonWithDeadline(url: string, init: RequestInit = {}, timeoutMs = 90_000): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json();
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json({ error: controller.signal.aborted ? "This is taking longer than expected. Your saved information is safe. Please try again." : "We couldn’t finish this request. Your saved information is safe. Please try again." }, { status: 503 });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}
