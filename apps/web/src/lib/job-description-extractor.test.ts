import { describe, expect, it } from "vitest";
import { extractJobPostingFromHtml, cleanHtmlToText } from "./job-description-extractor";

describe("job description extraction", () => {
  it("extracts structured schema.org/JobPosting JSON-LD correctly", () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Senior Software Engineer - TechCorp</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": "Senior AI Engineer",
            "description": "<p>We are looking for an <strong>AI Engineer</strong> to build scalable LLM applications.</p><ul><li>Design architectures</li><li>Deploy models</li></ul>",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "Acme Global"
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "San Francisco",
                "addressRegion": "CA",
                "addressCountry": "US"
              }
            },
            "employmentType": "FULL_TIME",
            "skills": ["Python", "PyTorch", "Kubernetes"],
            "responsibilities": ["Lead machine learning projects", "Scale distributed pipelines"],
            "qualifications": "5+ years of software experience and degree in CS"
          }
          </script>
        </head>
        <body><div>Some navigation</div></body>
      </html>
    `;

    const extracted = extractJobPostingFromHtml(sampleHtml, "https://example.com/job/123");
    expect(extracted).not.toBeNull();
    expect(extracted?.title).toBe("Senior AI Engineer");
    expect(extracted?.company).toBe("Acme Global");
    expect(extracted?.location).toContain("San Francisco, CA, US");
    expect(extracted?.method).toBe("json-ld");
    expect(extracted?.text).toContain("Role: Senior AI Engineer");
    expect(extracted?.text).toContain("Company: Acme Global");
    expect(extracted?.text).toContain("Lead machine learning projects");
    expect(extracted?.text).toContain("Python, PyTorch, Kubernetes");
  });

  it("handles @graph formatted JSON-LD blocks", () => {
    const sampleHtml = `
      <html>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList"
            },
            {
              "@type": "JobPosting",
              "title": "Staff Platform Architect",
              "hiringOrganization": "Hitachi Energy",
              "description": "Lead multi-cloud engineering for high-availability distributed systems with zero downtime requirements."
            }
          ]
        }
        </script>
      </html>
    `;

    const extracted = extractJobPostingFromHtml(sampleHtml);
    expect(extracted).not.toBeNull();
    expect(extracted?.title).toBe("Staff Platform Architect");
    expect(extracted?.company).toBe("Hitachi Energy");
    expect(extracted?.method).toBe("json-ld");
    expect(extracted?.text).toContain("multi-cloud engineering");
  });

  it("falls back to main job container when JSON-LD is absent", () => {
    const sampleHtml = `
      <html>
        <head>
          <meta property="og:title" content="DevOps Lead at Stripe" />
          <meta property="og:site_name" content="Stripe" />
        </head>
        <body>
          <div data-automation-id="jobPostingDescription">
            <h3>About the Role</h3>
            <p>Stripe is seeking an experienced DevOps Lead to maintain enterprise payment reliability across multiple AWS regions and manage Terraform infrastructure.</p>
          </div>
        </body>
      </html>
    `;

    const extracted = extractJobPostingFromHtml(sampleHtml);
    expect(extracted).not.toBeNull();
    expect(extracted?.method).toBe("html-container");
    expect(extracted?.title).toBe("DevOps Lead at Stripe");
    expect(extracted?.company).toBe("Stripe");
    expect(extracted?.text).toContain("DevOps Lead");
    expect(extracted?.text).toContain("Terraform infrastructure");
  });

  it("returns null when page contains no meaningful job description", () => {
    const emptyHtml = `<html><body><p>404 Page Not Found</p></body></html>`;
    const extracted = extractJobPostingFromHtml(emptyHtml);
    expect(extracted).toBeNull();
  });

  it("unescapes HTML entities properly", () => {
    const raw = "Requirements &amp; Qualifications: 5+ years &lt;code&gt; experience &quot;recommended&quot;";
    const cleaned = cleanHtmlToText(raw);
    expect(cleaned).toBe('Requirements & Qualifications: 5+ years <code> experience "recommended"');
  });
});
