import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { SafeUrlError, safeFetchPublicUrl } from "@/lib/safe-url-fetch";
import { cleanExtractedText, extractPdfResume, readImagesWithOcr } from "@/lib/resume-extraction";
import { consumeRateLimit } from "@/lib/rate-limit";
import { importedHtmlToText } from "@/lib/imported-html";
import { extractJobPostingFromHtml } from "@/lib/job-description-extractor";

export const runtime = "nodejs";

async function fetchWithProxy(url: string): Promise<string | null> {
  const scraperKey = process.env.SCRAPER_API_KEY || process.env.SCRAPING_API_KEY || process.env.SCRAPINGBEE_API_KEY;
  if (!scraperKey) return null;
  try {
    const proxyUrl = process.env.SCRAPINGBEE_API_KEY
      ? `https://app.scrapingbee.com/api/v1/?api_key=${scraperKey}&url=${encodeURIComponent(url)}&render_js=false`
      : `http://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(url)}&render=true`;
    const resp = await fetch(proxyUrl, { headers: { "Accept": "text/html" }, signal: AbortSignal.timeout(18_000) });
    if (resp.ok) return await resp.text();
  } catch {
    return null;
  }
  return null;
}

async function fetchJobWithAiSearch(jobUrl: string): Promise<{ text: string; title?: string; company?: string; location?: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const models = [
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash",
  ];
  const prompt = `Search Google for the exact job posting at this URL: ${jobUrl}.
Extract and return a JSON object with:
- "title": exact job title
- "company": company or employer name
- "location": location or remote
- "text": the complete job description text, including about the role, key responsibilities, requirements, and qualifications.
Return only valid JSON with no markdown wrapping.`;

  for (const model of models) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(18_000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
          }),
        }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
      if (!candidateText) continue;
      const cleanJson = candidateText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleanJson);
      if (parsed.text && parsed.text.length >= 80) {
        const heading = [
          parsed.title ? `Role: ${parsed.title}` : "",
          parsed.company ? `Company: ${parsed.company}` : "",
          parsed.location ? `Location: ${parsed.location}` : "",
        ].filter(Boolean).join("\n");
        return {
          text: `${heading}\n\nJob Description:\n${parsed.text}`.trim(),
          title: parsed.title,
          company: parsed.company,
          location: parsed.location,
        };
      }
    } catch (e) {
      console.warn(`[job-url-ai-search] Attempt with ${model} failed, trying fallback:`, e);
    }
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to open a job-description URL." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "job-url-import", limit: 15, windowSeconds: 600 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many job pages were opened. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const input = z.object({ url: z.string().trim().min(1).max(2_000) }).safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Enter a complete public job URL." }, { status: 400 });

  const rawUrl = input.data.url;
  let targetUrl = rawUrl;

  // 1. LinkedIn Normalization & Detection:
  // Convert LinkedIn search / collections / search-results URLs containing `currentJobId=...` into the direct canonical job URL
  if (/linkedin\.com\/jobs/i.test(targetUrl)) {
    const currentJobMatch = targetUrl.match(/[?&]currentJobId=(\d+)/i);
    if (currentJobMatch) {
      targetUrl = `https://www.linkedin.com/jobs/view/${currentJobMatch[1]}/`;
    }
  }

  if (/^https?:\/\/(?:[a-z0-9-]+\.)?linkedin\.com\/jobs\/(?:view|search|collections)/i.test(targetUrl)) {
    const jobIdMatch = targetUrl.match(/\/jobs\/view\/(\d+)/i) || targetUrl.match(/[?&]currentJobId=(\d+)/i);
    const urlsToTry = [
      ...(jobIdMatch ? [`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobIdMatch[1]}`] : []),
      targetUrl,
    ];

    for (const candidateUrl of urlsToTry) {
      try {
        const fetched = await safeFetchPublicUrl(candidateUrl);
        const text = new TextDecoder().decode(fetched.body);
        if (/authwall|login|sign[ -]?in|join[ -]?linkedin/i.test(fetched.finalUrl) || /<title>(?:Sign In|Security Verification)/i.test(text)) {
          continue;
        }
        const extracted = extractJobPostingFromHtml(text, targetUrl);
        if (extracted && extracted.text.length >= 80) {
          return NextResponse.json({
            text: extracted.text,
            sourceUrl: targetUrl,
            title: extracted.title,
            company: extracted.company,
            location: extracted.location,
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        // Continue to next candidate URL
      }
    }

    // Attempt proxy scraping if configured
    const proxyHtml = await fetchWithProxy(targetUrl);
    if (proxyHtml) {
      const extracted = extractJobPostingFromHtml(proxyHtml, targetUrl);
      if (extracted && extracted.text.length >= 80) {
        return NextResponse.json({
          text: extracted.text,
          sourceUrl: targetUrl,
          title: extracted.title,
          company: extracted.company,
          location: extracted.location,
          fetchedAt: new Date().toISOString(),
        });
      }
    }

    // Attempt Gemini Google Search Grounding to extract public LinkedIn job details
    const aiJob = await fetchJobWithAiSearch(targetUrl);
    if (aiJob && aiJob.text.length >= 80) {
      return NextResponse.json({
        text: aiJob.text,
        sourceUrl: targetUrl,
        title: aiJob.title,
        company: aiJob.company,
        location: aiJob.location,
        fetchedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: "LinkedIn blocked automated access for this link. Please copy and paste the job description text below." },
      { status: 403 }
    );
  }

  // 2. Specialized handling for Greenhouse Job Boards (including direct Stripe career links powered by Greenhouse)
  let greenhouseCompany = "";
  let greenhouseJobId = "";

  const ghDirect =
    rawUrl.match(/(?:job-boards|boards)\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i) ||
    rawUrl.match(/boards\.greenhouse\.io\/embed\/job_app\?for=([^&]+)&token=(\d+)/i);
  if (ghDirect) {
    greenhouseCompany = ghDirect[1];
    greenhouseJobId = ghDirect[2];
  } else {
    const stripeMatch = rawUrl.match(/stripe\.com\/(?:careers|jobs)\/listing\/[^/]+\/(\d+)/i);
    if (stripeMatch) {
      greenhouseCompany = "stripe";
      greenhouseJobId = stripeMatch[1];
    } else {
      const ghParamMatch = rawUrl.match(/[?&]gh_jid=(\d+)/i);
      if (ghParamMatch) {
        try {
          const parsedHost = new URL(rawUrl).hostname.replace(/^www\./i, "");
          const compGuess = parsedHost.split(".")[0];
          if (compGuess) {
            greenhouseCompany = compGuess;
            greenhouseJobId = ghParamMatch[1];
          }
        } catch {
          // ignore
        }
      }
    }
  }

  if (greenhouseCompany && greenhouseJobId) {
    try {
      const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(greenhouseCompany)}/jobs/${encodeURIComponent(greenhouseJobId)}`;
      const ghResp = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (ghResp.status === 404) {
        return NextResponse.json(
          {
            error: `Job #${greenhouseJobId} on ${greenhouseCompany.toUpperCase()} has expired or was closed by the employer on Greenhouse. Please enter an active job posting link or paste the job description below.`,
          },
          { status: 404 }
        );
      }
      if (ghResp.ok) {
        const data = (await ghResp.json()) as { title?: string; content?: string; location?: { name?: string } };
        const rawContent = (data.content ?? "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        const heading = `Role: ${data.title ?? "Job Opportunity"}\nCompany: ${greenhouseCompany.toUpperCase()}${data.location?.name ? `\nLocation: ${data.location.name}` : ""}\n\n`;
        const text = heading + importedHtmlToText(rawContent);
        if (text.length >= 80) {
          return NextResponse.json({
            text: text.slice(0, 50_000),
            sourceUrl: rawUrl,
            fetchedAt: new Date().toISOString(),
            title: data.title,
            company: greenhouseCompany.toUpperCase(),
            location: data.location?.name ?? "",
          });
        }
      }
    } catch {
      // Fall through to generic safe fetch
    }
  }

  // 3. Specialized handling for Lever (jobs.lever.co/<company>/<id>)
  const leverMatch = rawUrl.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/i);
  if (leverMatch) {
    const [, company, jobId] = leverMatch;
    try {
      const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(jobId)}`;
      const leverResp = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (leverResp.status === 404) {
        return NextResponse.json(
          {
            error: `This job posting on ${company.toUpperCase()} has expired or was closed on Lever. Please provide an active job link or paste the description below.`,
          },
          { status: 404 }
        );
      }
      if (leverResp.ok) {
        const data = (await leverResp.json()) as {
          text?: string;
          descriptionPlain?: string;
          additionalPlain?: string;
          categories?: { location?: string; commitment?: string };
        };
        const location = data.categories?.location ?? "";
        const heading = `Role: ${data.text ?? ""}\nCompany: ${company.toUpperCase()}${location ? `\nLocation: ${location}` : ""}\n\n`;
        const text = heading + `${data.descriptionPlain ?? ""}\n\n${data.additionalPlain ?? ""}`.trim();
        if (text.length >= 80) {
          return NextResponse.json({
            text: text.slice(0, 50_000),
            sourceUrl: rawUrl,
            fetchedAt: new Date().toISOString(),
            title: data.text,
            company: company.toUpperCase(),
            location,
          });
        }
      }
    } catch {
      // Fall through to generic safe fetch
    }
  }

  // 4. Specialized handling for Ashby (jobs.ashbyhq.com/<company>/<id>)
  const ashbyMatch = rawUrl.match(/jobs\.ashbyhq\.com\/([^/]+)\/([a-f0-9-]+)/i);
  if (ashbyMatch) {
    const [, company, jobId] = ashbyMatch;
    try {
      const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company)}/job/${encodeURIComponent(jobId)}`;
      const ashbyResp = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (ashbyResp.status === 404) {
        return NextResponse.json(
          {
            error: `This job posting on ${company.toUpperCase()} has expired or was closed on Ashby. Please provide an active job link or paste the description below.`,
          },
          { status: 404 }
        );
      }
      if (ashbyResp.ok) {
        const data = (await ashbyResp.json()) as { title?: string; descriptionHtml?: string; locationName?: string };
        const heading = `Role: ${data.title ?? ""}\nCompany: ${company.toUpperCase()}${data.locationName ? `\nLocation: ${data.locationName}` : ""}\n\n`;
        const text = heading + importedHtmlToText(data.descriptionHtml ?? "");
        if (text.length >= 80) {
          return NextResponse.json({
            text: text.slice(0, 50_000),
            sourceUrl: rawUrl,
            fetchedAt: new Date().toISOString(),
            title: data.title,
            company: company.toUpperCase(),
            location: data.locationName ?? "",
          });
        }
      }
    } catch {
      // Fall through to generic safe fetch
    }
  }

  // 5. Generic safe public fetch for all other URLs (Hitachi, Workday, Indeed, company career pages, etc.)
  try {
    const fetched = await safeFetchPublicUrl(targetUrl);
    let text = "";
    let title = "";
    let company = "";
    let location = "";

    if (fetched.contentType === "text/html") {
      const rawHtml = new TextDecoder().decode(fetched.body);
      const extracted = extractJobPostingFromHtml(rawHtml, fetched.finalUrl);
      if (extracted && extracted.text.length >= 50) {
        text = extracted.text;
        title = extracted.title;
        company = extracted.company;
        location = extracted.location;
      } else {
        text = importedHtmlToText(rawHtml);
      }
    } else if (fetched.contentType === "text/plain") {
      text = cleanExtractedText(new TextDecoder().decode(fetched.body));
    } else if (fetched.contentType === "application/pdf") {
      text = (await extractPdfResume(fetched.body)).text;
    } else if (["image/png", "image/jpeg"].includes(fetched.contentType)) {
      text = await readImagesWithOcr([fetched.body]);
    }

    if (text.length < 50) {
      const aiJob = await fetchJobWithAiSearch(targetUrl);
      if (aiJob && aiJob.text.length >= 80) {
        return NextResponse.json({
          text: aiJob.text,
          sourceUrl: targetUrl,
          title: aiJob.title,
          company: aiJob.company,
          location: aiJob.location,
          fetchedAt: new Date().toISOString(),
        });
      }
      if (/naukri\.com/i.test(targetUrl)) {
        return NextResponse.json(
          { error: "Naukri protected this link with bot verification. Please copy and paste the job description text directly below." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: "No meaningful job description could be extracted from that page. Paste the description below." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        text: text.slice(0, 50_000),
        sourceUrl: fetched.finalUrl,
        fetchedAt: new Date().toISOString(),
        contentType: fetched.contentType,
        title: title || undefined,
        company: company || undefined,
        location: location || undefined,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    // Attempt Gemini Google Search Grounding fallback for enterprise career links (Accenture, Workday, etc.)
    const aiJob = await fetchJobWithAiSearch(targetUrl);
    if (aiJob && aiJob.text.length >= 80) {
      return NextResponse.json({
        text: aiJob.text,
        sourceUrl: targetUrl,
        title: aiJob.title,
        company: aiJob.company,
        location: aiJob.location,
        fetchedAt: new Date().toISOString(),
      });
    }

    if (error instanceof SafeUrlError || (error && typeof error.message === "string" && error.name === "SafeUrlError")) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 422 });
    }
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
      return NextResponse.json({ error: "Request timed out while connecting to the job posting. Paste the description below." }, { status: 408 });
    }
    if (msg.includes("security") || msg.includes("private") || msg.includes("internal")) {
      return NextResponse.json({ error: "URL rejected by security validation: private or internal network destinations are not allowed." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Temporary server error while opening the job posting. Paste the description below." },
      { status: 422 }
    );
  }
}
