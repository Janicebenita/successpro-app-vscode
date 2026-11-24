import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 18_000;

export class SafeUrlError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "SafeUrlError";
  }
}

function ipv4Number(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? ((parts[0] * 2 ** 24) + (parts[1] * 2 ** 16) + (parts[2] * 2 ** 8) + parts[3]) >>> 0
    : null;
}

function inV4Range(value: number, base: string, bits: number) {
  const baseValue = ipv4Number(base)!;
  const block = 2 ** (32 - bits);
  return value >= baseValue && value < baseValue + block;
}

export function isPublicNetworkAddress(input: string) {
  const address = input.toLowerCase().split("%")[0];
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const version = isIP(mapped ?? address);
  if (version === 4) {
    const value = ipv4Number(mapped ?? address)!;
    return ![
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
      ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
      ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, bits]) => inV4Range(value, base as string, bits as number));
  }
  if (version === 6) {
    return !(
      address === "::" ||
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd") ||
      /^fe[89ab]/.test(address) ||
      address.startsWith("ff") ||
      address.startsWith("2001:db8:")
    );
  }
  return false;
}

export function validateExternalUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeUrlError("Enter a complete public job URL beginning with https://.", 400);
  }
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new SafeUrlError("Only public HTTP or HTTPS job pages can be opened.", 400);
  }
  if (url.username || url.password) {
    throw new SafeUrlError("Job URLs cannot contain sign-in details.", 400);
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new SafeUrlError("This URL uses a network port we cannot open.", 400);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new SafeUrlError("Use a public job-posting URL. Internal addresses are not allowed.", 403);
  }
  if (isIP(hostname) && !isPublicNetworkAddress(hostname)) {
    throw new SafeUrlError("URL rejected by security validation: private or internal network destinations are not allowed.", 403);
  }
  url.hash = "";
  return url;
}

export interface SafeResponse {
  finalUrl: string;
  contentType: string;
  body: Uint8Array;
}

export async function safeFetchPublicUrl(value: string, redirectCount = 0): Promise<SafeResponse> {
  const url = validateExternalUrl(value);

  // Validate DNS resolution against internal / private IP addresses (SSRF & Rebinding Protection)
  const records = await dnsLookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!records.length) {
    throw new SafeUrlError("This job address could not be resolved. Check the URL and try again.", 404);
  }
  if (records.some((record) => !isPublicNetworkAddress(record.address))) {
    throw new SafeUrlError("URL rejected by security validation: private or internal network destinations are not allowed.", 403);
  }
  const selected = records[0];

  const client = url.protocol === "https:" ? https : http;
  const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0",
          "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
        lookup: (_hostname: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
          const cb = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback) as (
            err: Error | null,
            address: unknown,
            family?: number
          ) => void;
          const opts = (typeof optionsOrCallback === "object" && optionsOrCallback !== null ? optionsOrCallback : {}) as { all?: boolean };
          if (typeof cb === "function") {
            if (opts.all) {
              cb(null, [{ address: selected.address, family: selected.family }]);
            } else {
              cb(null, selected.address, selected.family);
            }
          }
        },
        servername: url.hostname,
        agent: false,
        timeout: TIMEOUT_MS,
      },
      resolve
    );

    request.once("timeout", () => {
      request.destroy(new SafeUrlError("The job page took too long to respond. Paste the description below.", 408));
    });
    request.once("error", (err) => {
      if (err instanceof SafeUrlError) reject(err);
      else reject(new SafeUrlError("We could not establish a connection to that job page. Paste the description below.", 502));
    });
    request.end();
  });

  const status = response.statusCode ?? 500;

  // Handle HTTP redirects with strict validation at every hop
  if ([301, 302, 303, 307, 308].includes(status)) {
    response.resume();
    if (redirectCount >= MAX_REDIRECTS) {
      throw new SafeUrlError("The job page redirected too many times.", 422);
    }
    const location = response.headers.location;
    if (!location) {
      throw new SafeUrlError("The job page returned an invalid redirect destination.", 422);
    }
    // Re-resolve and re-validate redirect target safely
    const targetUrl = new URL(location, url).toString();
    return safeFetchPublicUrl(targetUrl, redirectCount + 1);
  }

  // Meaningful HTTP status handling with specific user-friendly messages
  if (status === 401 || status === 403) {
    response.resume();
    throw new SafeUrlError("Website blocked automated access or requires authentication to view. Paste the job description below.", status);
  }
  if (status === 404 || status === 410) {
    response.resume();
    throw new SafeUrlError("This job posting no longer exists or was removed by the employer.", status);
  }
  if (status === 429) {
    response.resume();
    throw new SafeUrlError("The job board is temporarily rate-limiting requests. Wait a minute or paste the description below.", 429);
  }
  if (status >= 500) {
    response.resume();
    throw new SafeUrlError(`The job board server encountered a temporary error (status ${status}). Paste the description below.`, status);
  }
  if (status < 200 || status >= 300) {
    response.resume();
    throw new SafeUrlError(`The job page returned status ${status}. Paste the description below.`, 422);
  }

  const declaredLength = Number(response.headers["content-length"] ?? 0);
  if (declaredLength > MAX_BYTES * 2) {
    response.resume();
    throw new SafeUrlError("The job page is larger than 5 MB.", 413);
  }

  const contentType = String(response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (
    contentType &&
    !["text/html", "application/xhtml+xml", "text/plain", "application/pdf", "image/png", "image/jpeg", "application/octet-stream"].includes(contentType)
  ) {
    response.resume();
    throw new SafeUrlError("This job URL does not contain a supported job webpage, PDF, or document.", 415);
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BYTES * 2) {
      response.destroy();
      throw new SafeUrlError("The job page exceeds the 5 MB size limit.", 413);
    }
    chunks.push(bytes);
  }
  const rawBody = Buffer.concat(chunks);

  // Decompress body if needed (gzip, deflate, brotli)
  const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase().trim();
  let decompressed = rawBody;
  if (encoding === "gzip" || encoding === "x-gzip") {
    try {
      decompressed = zlib.gunzipSync(rawBody);
    } catch {
      decompressed = rawBody;
    }
  } else if (encoding === "deflate") {
    try {
      decompressed = zlib.inflateSync(rawBody);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(rawBody);
      } catch {
        decompressed = rawBody;
      }
    }
  } else if (encoding === "br") {
    try {
      decompressed = zlib.brotliDecompressSync(rawBody);
    } catch {
      decompressed = rawBody;
    }
  }

  if (decompressed.length > MAX_BYTES) {
    throw new SafeUrlError("The job page exceeds the 5 MB size limit.", 413);
  }

  const finalContentType = contentType === "application/xhtml+xml" || !contentType ? "text/html" : contentType;
  return {
    finalUrl: url.toString(),
    contentType: finalContentType,
    body: new Uint8Array(decompressed),
  };
}
