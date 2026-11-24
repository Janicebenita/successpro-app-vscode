"use client";

import { useState } from "react";
import type { ResumeAnalysisResult, GapRiskResult } from "@successpro/contracts";
import { GapRiskDetection } from "./gap-risk-detection";

export function WorkbookReview({
  result,
  isPaid = true,
  analysisId,
  gapRiskAnalysis,
  isReused = false,
}: {
  result: NonNullable<ResumeAnalysisResult["v2"]>;
  isPaid?: boolean;
  analysisId?: string;
  gapRiskAnalysis?: GapRiskResult | null;
  isReused?: boolean;
}) {
  const [showAllActions, setShowAllActions] = useState(false);
  const actionPlan = result.paidReport?.actionPlan ?? [];
  const topActions = showAllActions ? actionPlan : actionPlan.slice(0, 3);

  const modeTitle =
    result.mode === "with_job_description"
      ? "Targeted Role Assessment (Content · Visual · Job Match)"
      : "General Resume Assessment (Content · Visual Presentation)";

  return (
    <section aria-label="Workbook assessment" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.25rem", color: "#1e293b", overflowWrap: "anywhere" }}>
      {/* 1. Executive Summary Hero Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.25rem",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
        }}
      >
        <div>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", fontWeight: 700, display: "block" }}>
            {modeTitle}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.6rem", marginTop: "0.35rem" }}>
            <span style={{ fontSize: "3.2rem", fontWeight: 900, color: "#0284c7", lineHeight: 1 }}>
              {result.cumulativeScore !== null ? result.cumulativeScore.toFixed(1) : "Score Pending"}
            </span>
            {result.cumulativeScore !== null ? (
              <span style={{ fontSize: "1.4rem", color: "#94a3b8", fontWeight: 600 }}>/ 100</span>
            ) : null}
            {result.descriptiveBand && (
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: (result.cumulativeScore ?? result.confirmedEarnedPoints) >= 75 ? "#15803d" : (result.cumulativeScore ?? result.confirmedEarnedPoints) >= 60 ? "#b45309" : "#b91c1c",
                  background: (result.cumulativeScore ?? result.confirmedEarnedPoints) >= 75 ? "#dcfce7" : (result.cumulativeScore ?? result.confirmedEarnedPoints) >= 60 ? "#fef3c7" : "#fee2e2",
                  padding: "4px 12px",
                  borderRadius: "12px",
                  border: `1px solid ${(result.cumulativeScore ?? result.confirmedEarnedPoints) >= 75 ? "#bbf7d0" : (result.cumulativeScore ?? result.confirmedEarnedPoints) >= 60 ? "#fde68a" : "#fca5a5"}`,
                  marginLeft: "0.5rem",
                }}
              >
                {result.descriptiveBand}
              </span>
            )}
          </div>
          {result.cumulativeScore === null && (
            <div style={{ margin: "0.5rem 0 0" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#b45309", fontWeight: 500 }}>
                The overall score is pending until the remaining criteria can be assessed.
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                <span>{result.mode === "with_job_description" ? "With job description · 50 Content / 25 Visual / 25 Job Match" : "No job description · 65 Content / 35 Visual"}</span>
                {result.possibleScoreRange ? <span> · Possible range: {result.possibleScoreRange.join("–")} / 100</span> : null}
              </p>
            </div>
          )}
        </div>

        {analysisId && (
          <div>
            {isPaid ? (
              <a
                className="button button-primary"
                href={`/api/reviews/${analysisId}/report`}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.25rem", fontWeight: 700, borderRadius: "10px" }}
              >
                <span>📄 Download Complete Audit PDF</span>
              </a>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1", color: "#64748b", fontSize: "0.82rem" }}>
                <span>🔒 Full PDF Audit Report</span>
                <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>Paid Plan</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Core Pillars Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "1rem" }}>
        {Object.values(result.pillars).map((pillar) => {
          const isContent = pillar.pillar === "content";
          const isVisual = pillar.pillar === "visual";
          const color = isContent ? "#7c3aed" : isVisual ? "#059669" : "#d97706";
          const borderColor = isContent ? "#ddd6fe" : isVisual ? "#a7f3d0" : "#fde68a";
          const bgColor = isContent ? "#f5f3ff" : isVisual ? "#ecfdf5" : "#fffbeb";
          const title = isContent ? "Content Quality" : isVisual ? "Visual Presentation" : "Job Description Match";
          const pct = pillar.fixedMaxPoints > 0 ? Math.round((pillar.confirmedEarned / pillar.fixedMaxPoints) * 100) : 0;
          const statusLabel = pillar.state === "Pending" ? "Pending" : pillar.state === "Partial" ? "Partial" : pillar.state === "Excluded" ? "Excluded (No JD)" : pct >= 90 ? "Exceptional" : pct >= 75 ? "Strong" : pct >= 50 ? "Moderate" : "Needs Work";

          return (
            <div
              key={pillar.pillar}
              style={{
                background: bgColor,
                border: `1.5px solid ${borderColor}`,
                borderRadius: "14px",
                padding: "1.2rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{pillar.pillar}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", background: "rgba(255, 255, 255, 0.8)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.06)" }}>
                  {statusLabel}
                </span>
              </div>
              <div>
                <div style={{ fontSize: "2.3rem", fontWeight: 900, color, lineHeight: 1.1 }}>
                  {pillar.state === "Excluded" ? "N/A" : pillar.state !== "Assessed" ? "Pending" : `${pct}%`}
                </div>
                <strong style={{ display: "block", marginTop: "0.35rem", fontSize: "0.95rem", color: "#0f172a" }}>{title}</strong>
              </div>
              {pillar.pendingMaxPoints ? (
                <small style={{ color: "#b45309", display: "block", marginTop: "0.5rem", fontSize: "0.78rem", fontWeight: 600 }}>
                  Criteria still pending
                </small>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 3. Top Action Plan (Minimal & High Impact) */}
      {isPaid && actionPlan.length > 0 && (
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "1.4rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "1.1rem" }}>
            <div>
              <span className="section-kicker" style={{ color: "#0284c7", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em" }}>
                RECOMMENDED FIXES
              </span>
              <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                Top Priority Improvements ({showAllActions ? actionPlan.length : Math.min(3, actionPlan.length)} of {actionPlan.length})
              </h3>
            </div>
            {actionPlan.length > 3 && (
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "0.4rem 0.95rem", fontSize: "0.82rem", fontWeight: 600, borderRadius: "8px" }}
                onClick={() => setShowAllActions((prev) => !prev)}
              >
                {showAllActions ? "Show Top 3 Only" : `View All ${actionPlan.length} Items`}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gap: "0.9rem" }}>
            {topActions.map((action, idx) => (
              <article
                key={action.parameterId + idx}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "1.1rem 1.25rem",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: action.priority === "P0" ? "#fee2e2" : action.priority === "P1" ? "#fef3c7" : "#e0f2fe",
                        color: action.priority === "P0" ? "#b91c1c" : action.priority === "P1" ? "#b45309" : "#0369a1",
                        border: `1px solid ${action.priority === "P0" ? "#fca5a5" : action.priority === "P1" ? "#fde68a" : "#bae6fd"}`,
                      }}
                    >
                      {action.priority} · {action.parameterId}
                    </span>
                    <strong style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 700 }}>{action.issue}</strong>
                  </div>
                </div>

                {action.likelyEffect && (
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.88rem", color: "#b91c1c", lineHeight: 1.5 }}>
                    <strong style={{ color: "#991b1b" }}>Consequence / Risk: </strong>{action.likelyEffect}
                  </p>
                )}

                <p style={{ margin: "0.15rem 0 0", fontSize: "0.92rem", color: "#166534", lineHeight: 1.55 }}>
                  <strong style={{ color: "#14532d" }}>Recommended Solution: </strong>{action.howToCorrect}
                </p>

                {/* Line Causing Issue */}
                {action.originalLine && (
                  <div style={{ marginTop: "0.45rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.2rem" }}>
                      Resume evidence
                    </span>
                    <blockquote
                      style={{
                        margin: 0,
                        padding: "0.55rem 0.85rem",
                        background: "#fef2f2",
                        borderLeft: "3.5px solid #ef4444",
                        borderRadius: "0 6px 6px 0",
                        fontSize: "0.85rem",
                        color: "#991b1b",
                        lineHeight: 1.45,
                      }}
                    >
                      "{action.originalLine}"
                    </blockquote>
                  </div>
                )}


              </article>
            ))}
          </div>
        </section>
      )}

      {/* 3b. Free Tier Action Plan Locked Card */}
      {!isPaid && (
        <div
          style={{
            background: "#ffffff",
            border: "1.5px dashed #cbd5e1",
            borderRadius: "14px",
            padding: "1.75rem",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "1.15rem", display: "block", marginBottom: "0.4rem", color: "#0f172a", fontWeight: 800 }}>
            🔒 Action Plan & Recommended Fixes (Premium Feature)
          </span>
          <p style={{ color: "#64748b", fontSize: "0.9rem", maxWidth: "560px", margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
            Free accounts receive the overall score and 20 parameter ratings. Upgrading unlocks the prioritized P0–P3 roadmap, time estimates, and step-by-step rewrite formulas.
          </p>
          <span
            className="status-pill"
            style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", fontWeight: 700 }}
          >
            Included in Paid Plan
          </span>
        </div>
      )}

      {/* 4. Timeline & ATS Diagnostic Notes (Collapsed by default to prevent visual clutter) */}
      {result.operationalWarnings.length > 0 && (
        <details
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            padding: "0.85rem 1.2rem",
          }}
        >
          <summary style={{ cursor: "pointer", color: "#b45309", fontSize: "0.92rem", fontWeight: 700 }}>
            ⚠️ View Timeline & Employment Consistency Notes ({result.operationalWarnings.length})
          </summary>
          <ul style={{ margin: "0.75rem 0 0 1.25rem", color: "#475569", fontSize: "0.86rem", display: "grid", gap: "0.4rem", lineHeight: 1.5 }}>
            {result.operationalWarnings.map((w, index) => (
              <li key={`${w}-${index}`}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {/* 5. Complete 20-Parameter Breakdown (Collapsed by default for a clean screen) */}
      <details
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "1rem 1.25rem",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}
      >
        <summary style={{ cursor: "pointer", color: "#0f172a", fontWeight: 700, fontSize: "0.95rem" }}>
          📊 View Detailed Assessment Breakdown ({result.parameters.length} Criteria)
        </summary>
        <p style={{ margin: "0.6rem 0 1rem", fontSize: "0.84rem", color: "#64748b" }}>
          Every score is calculated using the SuccessPro workbook rubric. Download the full PDF report for an offline executive summary.
        </p>
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {result.parameters.map((p) => {
            const cleanExcerpt = p.evidence.excerpt ? p.evidence.excerpt.replace(/;?\s*resume characters \d+-\d+/gi, "").trim() : "";
            const earned = typeof p.earnedPoints === "number" ? Math.round(p.earnedPoints * 10) / 10 : 0;
            const max = typeof p.effectiveMaxWeight === "number" ? Math.round(p.effectiveMaxWeight * 10) / 10 : 0;
            const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
            const isGood = pct >= 75;
            const isFair = pct >= 50 && pct < 75;
            const ratingColor = isGood ? "#15803d" : isFair ? "#b45309" : "#b91c1c";
            const ratingBg = isGood ? "#dcfce7" : isFair ? "#fef3c7" : "#fee2e2";
            const statusLabel = pct >= 90 ? "Exceptional" : pct >= 75 ? "Strong" : pct >= 50 ? "Acceptable" : "Needs Work";
            const scoreLabel = max > 0
              ? `${earned.toFixed(1)} / ${max.toFixed(1)} pts · ${statusLabel}`
              : p.status === "Pending"
              ? "Pending"
              : "Excluded";

            return (
              <article
                key={p.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "0.95rem 1.1rem",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                    {p.id} · {p.name}
                  </strong>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: ratingColor, background: ratingBg, padding: "2px 8px", borderRadius: "6px", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {p.status === "Pending" ? "Pending" : p.rating === null ? "Unrated" : scoreLabel}
                  </span>
                </div>
                {p.naOrPendingReason && <p style={{ margin: "0.2rem 0", fontSize: "0.84rem", color: "#64748b" }}>{p.naOrPendingReason}</p>}
                {cleanExcerpt && (
                  <blockquote
                    style={{
                      margin: "0.4rem 0",
                      padding: "0.45rem 0.75rem",
                      background: "#f1f5f9",
                      borderLeft: "3px solid #94a3b8",
                      fontSize: "0.84rem",
                      color: "#334155",
                      lineHeight: 1.45,
                    }}
                  >
                    {cleanExcerpt}
                  </blockquote>
                )}
                {p.evidence.rationale && <small style={{ color: "#64748b", display: "block", fontSize: "0.82rem", marginTop: "0.3rem" }}>{p.evidence.rationale}</small>}
              </article>
            );
          })}
        </div>
      </details>

      <GapRiskDetection data={gapRiskAnalysis} />

      {result.displayFootnote ? <small style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{result.displayFootnote}</small> : null}
    </section>
  );
}
