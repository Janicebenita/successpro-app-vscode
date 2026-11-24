"use client";

import { fetchJsonWithDeadline } from "@/lib/client-json-request";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { salaryResearchSchema, type CanonicalProfile, type CareerGoal, type SalaryResearch, type SalarySource } from "@successpro/contracts";
import { analyseSalaryResearch } from "@successpro/domain";
import type { AiTaskOutput } from "@successpro/contracts/ai";
import { currencyForLocation } from "@/lib/geography";
import { experienceYearsFromProfile } from "@/lib/experience-years";

function list(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function money(value: number, currency: string) { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function withoutOldComparison(research: SalaryResearch): SalaryResearch { return { ...research, sources: [], searchSuggestionHtml: "" }; }
function comparisonKey(research: SalaryResearch) { return JSON.stringify([research.role.trim(), research.location.trim(), research.yearsExperience, research.industry.trim(), research.currency]); }


export function SalaryWorkspace({ initial, profile, goal }: { initial: unknown; profile: CanonicalProfile | null; goal: CareerGoal | null }) {
  const parsed = salaryResearchSchema.safeParse(initial);
  const [research, setResearch] = useState<SalaryResearch>(parsed.success ? { ...parsed.data, yearsExperience: parsed.data.yearsExperience || experienceYearsFromProfile(profile) } : {
    role: profile?.currentRole || profile?.experience?.[0]?.title || goal?.targetRole || profile?.targetRoles?.[0] || "",
    location: profile?.location || goal?.targetGeography || "",
    yearsExperience: experienceYearsFromProfile(profile),
    industry: goal?.targetIndustry || profile?.industry || "",
    companySize: "unspecified",
    skills: profile?.skills?.slice(0, 12) || [],
    education: profile?.education?.[0]?.qualification || "",
    currentCompensation: null,
    targetCompensation: goal?.targetSalary ?? null,
    currency: currencyForLocation(profile?.location || goal?.targetGeography || "", goal?.currency || "INR"),
    sources: [],
    searchSuggestionHtml: "",
  });
  const [status, setStatus] = useState("");
  const [marketChecking, setMarketChecking] = useState(false);
  const autoRequested = useRef(false);
  const [narrative, setNarrative] = useState<AiTaskOutput<"salaryNarrative"> | null>(null);
  const analysis = useMemo(() => analyseSalaryResearch(research), [research]);
  const currentComparisonKey = comparisonKey(research);

  async function save() {
    const valid = salaryResearchSchema.safeParse(research);
    if (!valid.success) { setStatus(valid.error.issues[0]?.message ?? "Check the details."); return; }
    setStatus("Saving…");
    const response = await fetchJsonWithDeadline("/api/salary", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid.data) });
    const body = await response.json(); setStatus(response.ok ? "Salary research saved." : body.error ?? "Unable to save.");
  }
  async function explainRange() {
    setStatus("Preparing an explanation from the market research…");
    const response = await fetchJsonWithDeadline("/api/ai/salaryNarrative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ research, calculatedRange: analysis.range, confidence: analysis.confidence }) });
    const body = await response.json();
    if (response.ok) { setNarrative(body.output); setStatus(body.meta.validation === "fallback" ? "A source-based explanation is ready. Tailored suggestions are temporarily unavailable." : "Your tailored salary explanation is ready."); }
    else setStatus(body.error ?? "Unable to explain this range.");
  }
  const researchMarket = useCallback(async () => {
    if (!research.role.trim() || !research.location.trim()) { setStatus("Add your present role and job location to your profile to see a relevant benchmark."); return; }
    const requestedComparison = currentComparisonKey;
    setMarketChecking(true); setStatus("Researching current salary evidence for your role, location, experience, and industry…");
    try {
      const response = await fetchJsonWithDeadline("/api/salary/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: research.role, location: research.location, yearsExperience: research.yearsExperience, industry: research.industry, currency: research.currency }) }, 110_000);
      const body = await response.json();
      if (!response.ok) { setStatus(body.error ?? "No reliable regional benchmark is available yet. We will not guess a salary range."); return; }
      setResearch((current) => comparisonKey(current) === requestedComparison ? { ...current, currency: body.currency ?? current.currency, sources: body.sources as SalarySource[], searchSuggestionHtml: body.searchSuggestionHtml ?? "" } : current);
      setStatus(body.disclaimer);
    } catch { setStatus("Market research is temporarily unavailable. Your profile and saved benchmark are unchanged; please try again shortly."); }
    finally { setMarketChecking(false); }
  }, [research.role, research.location, research.yearsExperience, research.industry, research.currency, currentComparisonKey]);
  useEffect(() => {
    if (autoRequested.current || research.sources.length || !research.role.trim() || !research.location.trim()) return;
    autoRequested.current = true;
    void researchMarket();
  }, [research.sources.length, research.role, research.location, researchMarket]);
  return <div className="salary-workspace">
    <section className="work-card profile-intro"><div><span className="status-pill">SALARY BENCHMARKING</span><h2>Compare your pay with the market</h2><p>We start with your present role and job location, then use current online research to find comparable salary evidence. Your experience and industry sharpen the search. We show every source and do not guess when evidence is insufficient.</p></div><div className="report-actions"><button className="button button-secondary" disabled={marketChecking} onClick={() => void researchMarket()}>{marketChecking ? "Researching the market…" : "Refresh market benchmark"}</button><button className="button button-primary" onClick={() => void save()}>Save benchmark</button></div></section>
    <section className="profile-grid">
      <article className="work-card form-grid"><h3>Your comparison</h3><p className="document-note">The location starts with your present-job geography. The currency follows that market automatically and can be corrected if needed.</p><div className="form-columns"><label className="form-field">Present role<input value={research.role} onChange={(event) => setResearch(withoutOldComparison({ ...research, role: event.target.value }))} /></label><label className="form-field">Present job geography<input value={research.location} onChange={(event) => { const location = event.target.value; setResearch(withoutOldComparison({ ...research, location, currency: currencyForLocation(location, research.currency) })); }} placeholder="City, state/region, country" /></label></div><div className="form-columns"><label className="form-field">Relevant experience (years) <span className="field-help">Optional refinement</span><input type="number" min="0" max="60" value={research.yearsExperience || ""} onChange={(event) => setResearch(withoutOldComparison({ ...research, yearsExperience: Number(event.target.value) }))} /></label><label className="form-field">Industry<input value={research.industry} onChange={(event) => setResearch(withoutOldComparison({ ...research, industry: event.target.value }))} /></label></div><div className="form-columns"><label className="form-field">Employer size<select value={research.companySize} onChange={(event) => setResearch({ ...research, companySize: event.target.value as SalaryResearch["companySize"] })}><option value="unspecified">Not specified</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="enterprise">Enterprise</option></select></label><label className="form-field">Education or credentials<input value={research.education} onChange={(event) => setResearch({ ...research, education: event.target.value })} /></label></div><label className="form-field">Relevant skills <span className="field-help">Separate with commas</span><input value={research.skills.join(", ")} onChange={(event) => setResearch({ ...research, skills: list(event.target.value) })} /></label><div className="form-columns"><label className="form-field">Current annual compensation<input type="number" min="0" value={research.currentCompensation ?? ""} onChange={(event) => setResearch({ ...research, currentCompensation: event.target.value ? Number(event.target.value) : null })} /></label><label className="form-field">Target annual compensation<input type="number" min="0" value={research.targetCompensation ?? ""} onChange={(event) => setResearch({ ...research, targetCompensation: event.target.value ? Number(event.target.value) : null })} /></label></div><label className="form-field">Local market currency<select value={research.currency} onChange={(event) => setResearch(withoutOldComparison({ ...research, currency: event.target.value }))}>{["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD", "JPY", "CHF", "NZD", "ZAR", "SAR"].map((currency) => <option key={currency}>{currency}</option>)}</select></label><p className="save-status" role="status">{status}</p></article>
      <article className="work-card salary-result"><span className="section-kicker">MARKET VIEW</span>{analysis.range ? <><div className="salary-range"><strong>{money(analysis.range.low, research.currency)} – {money(analysis.range.high, research.currency)}</strong><span>Central estimate {money(analysis.range.midpoint, research.currency)}</span></div><span className={`confidence confidence-${analysis.confidence}`}>{analysis.confidence} confidence</span><p>{analysis.explanation}</p>{analysis.currentGap !== null && <p><strong>Gap to central estimate:</strong> {money(analysis.currentGap, research.currency)}</p>}{analysis.targetPosition && <p><strong>Your target is {analysis.targetPosition}.</strong></p>}<button className="button button-dark" type="button" onClick={() => void explainRange()}>Explain my range</button></> : <><strong>No reliable comparison available yet</strong><p>{analysis.explanation}</p></>}{narrative && <div className="salary-narrative"><h3>What this means for you</h3><p>{narrative.narrative}</p>{narrative.adjacentRoles.length > 0 && <><h4>Nearby roles to explore</h4><ul>{narrative.adjacentRoles.map((item) => <li key={item.role}><strong>{item.role}:</strong> {item.rationale}</li>)}</ul></>}</div>}<h3>What can move the range</h3><ul>{analysis.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul><h3>Checks before negotiating</h3><ul>{analysis.nextChecks.map((item) => <li key={item}>{item}</li>)}</ul></article>
    </section>
    <section className="work-card salary-sources"><h3>Our market research</h3><p>SuccessPro searches the web for comparable roles. These references explain the benchmark; you do not need to provide sources or salary estimates.</p>{research.sources.length ? <div className="salary-source-list">{research.sources.map((source) => <article className="salary-source" key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a><p>{money(source.low, research.currency)} to {money(source.high, research.currency)} annually</p><small>{source.dateBasis === "accessed" ? "Checked" : "Published"} {source.publishedOn}</small></article>)}</div> : <p>{marketChecking ? "Searching for comparable roles in your region…" : "No reliable comparison found yet. Refresh the search or refine your role and location above."}</p>}{research.searchSuggestionHtml && <iframe className="salary-search-suggestions" title="Google Search suggestions for this market research" srcDoc={research.searchSuggestionHtml} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" />}</section>
  </div>;
}
