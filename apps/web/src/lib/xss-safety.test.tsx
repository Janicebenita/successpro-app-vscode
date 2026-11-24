import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";
import { importedHtmlToText } from "./imported-html";

const attack = `<img src=x onerror="globalThis.xss=1"><script>globalThis.xss=2</script>`;

describe("user and imported content XSS controls", () => {
  it("keeps user-entered markup inert when rendered", () => {
    const html = renderToStaticMarkup(<article><h1>{attack}</h1><p>{attack}</p></article>);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("removes executable imported markup before job text is stored or displayed", () => {
    const text = importedHtmlToText(`<main><h1>Product Manager</h1>${attack}<p>Build safe products &amp; services.</p></main>`);
    expect(text).toContain("Product Manager");
    expect(text).toContain("Build safe products & services.");
    expect(text).not.toContain("globalThis.xss");
    expect(text).not.toContain("onerror");
  });

  it("rejects executable URL schemes in every member profile link type", () => {
    const base = { fullName: "Test Member", headline: "Product leader", location: "", summary: "", currentRole: "", industry: "", skills: [], experience: [], education: [], projects: [], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: [], links: [], targetRoles: [], openToWork: false, publicProfileEnabled: false };
    expect(canonicalProfileSchema.safeParse({ ...base, links: [{ id: "link-1", label: "Portfolio", url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(canonicalProfileSchema.safeParse({ ...base, projects: [{ id: "project-1", name: "Project", description: "", link: "data:text/html,<script>alert(1)</script>" }] }).success).toBe(false);
    expect(canonicalProfileSchema.safeParse({ ...base, certifications: [{ id: "cert-1", name: "Certificate", issuer: "", date: "", credentialUrl: "https://example.com/certificate" }] }).success).toBe(true);
  });
});
