import { describe, expect, it } from "vitest";
import { isPublicNetworkAddress, validateExternalUrl, SafeUrlError } from "./safe-url-fetch";

describe("safe external job URLs", () => {
  it.each([
    "127.0.0.1", "127.1.2.3", "10.0.0.4", "172.16.0.1", "172.31.255.255", "192.168.1.2", "169.254.169.254",
    "0.0.0.0", "100.64.0.1", "198.18.0.1", "224.0.0.1", "::1", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1",
  ])("rejects private or reserved address %s", (address) => expect(isPublicNetworkAddress(address)).toBe(false));

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])("accepts public address %s", (address) => expect(isPublicNetworkAddress(address)).toBe(true));

  it.each([
    "file:///etc/passwd", "ftp://example.com/job", "http://localhost/job", "http://service.internal/job", "http://127.0.0.1/job",
    "http://169.254.169.254/latest/meta-data", "https://user:pass@example.com/job", "https://example.com:8443/job",
  ])("rejects hostile or internal URL %s", (url) => {
    expect(() => validateExternalUrl(url)).toThrow(SafeUrlError);
  });

  it("normalizes an ordinary public job URL", () => {
    expect(validateExternalUrl("https://jobs.example.com/opening?id=1#details").toString()).toBe("https://jobs.example.com/opening?id=1");
  });

  it("creates SafeUrlError with appropriate status codes", () => {
    const err403 = new SafeUrlError("Website blocked automated access or requires authentication to view.", 403);
    expect(err403.status).toBe(403);
    expect(err403.message).toContain("blocked automated access");

    const err404 = new SafeUrlError("This job posting no longer exists or was removed by the employer.", 404);
    expect(err404.status).toBe(404);

    const err408 = new SafeUrlError("The job page took too long to respond.", 408);
    expect(err408.status).toBe(408);
  });
});
