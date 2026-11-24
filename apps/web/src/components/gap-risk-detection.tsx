"use client";

import { useState } from "react";
import type { GapRiskResult, GapRiskFinding, GapRiskCategory, GapRiskSeverity } from "@successpro/contracts";

interface GapRiskDetectionProps {
  data?: GapRiskResult | null;
}

const SEVERITY_CONFIG: Record<GapRiskSeverity, { label: string; bg: string; color: string; border: string; icon: string }> = {
  Critical: {
    label: "Critical",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fca5a5",
    icon: "🚨",
  },
  High: {
    label: "High",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#fdba74",
    icon: "⚠️",
  },
  Medium: {
    label: "Medium",
    bg: "#fefce8",
    color: "#854d0e",
    border: "#fde047",
    icon: "⚡",
  },
  Low: {
    label: "Low",
    bg: "#f8fafc",
    color: "#475569",
    border: "#cbd5e1",
    icon: "ℹ️",
  },
};

const CATEGORY_LABELS: Record<GapRiskCategory, string> = {
  timeline_gap: "Timeline Gaps",
  missing_information: "Missing Information",
    content_quality: "Writing observations",
  contradiction: "Contradictions",
  ats_technical: "ATS Technical",
};

export function GapRiskDetection({ data }: GapRiskDetectionProps) {
  const [activeCategory, setActiveCategory] = useState<GapRiskCategory | "all">("all");

  if (!data) return null;

  const { summary, findings } = data;

  const filteredFindings = activeCategory === "all"
    ? findings
    : findings.filter((finding) => finding.category === activeCategory);

  return (
    <section aria-label="Resume Gap & Risk Detection" className="work-card gap-risk-panel" style={{ marginTop: "1.75rem", border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="status-pill" style={{ background: "#ede9fe", color: "#6d28d9", fontWeight: 700 }}>RISK & GAP AUDIT</span>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Independent Quality & Integrity Check</span>
          </div>
          <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0.4rem 0 0.2rem 0", color: "#0f172a" }}>Resume Gap &amp; Risk Detection</h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#475569", maxWidth: "680px" }}>
            Advisory findings add no deductions to the 20-criterion score. Career gaps are timeline notes, and any explanation is optional.
          </p>
        </div>

        {/* Severity Summary Counter Badges */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ textAlign: "center", padding: "0.4rem 0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{summary.totalIssues}</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total</div>
          </div>
          {summary.criticalCount > 0 && (
            <div style={{ textAlign: "center", padding: "0.4rem 0.75rem", background: SEVERITY_CONFIG.Critical.bg, border: `1px solid ${SEVERITY_CONFIG.Critical.border}`, borderRadius: "8px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: SEVERITY_CONFIG.Critical.color }}>{summary.criticalCount}</div>
              <div style={{ fontSize: "0.72rem", color: SEVERITY_CONFIG.Critical.color, textTransform: "uppercase", fontWeight: 700 }}>Critical</div>
            </div>
          )}
          {summary.highCount > 0 && (
            <div style={{ textAlign: "center", padding: "0.4rem 0.75rem", background: SEVERITY_CONFIG.High.bg, border: `1px solid ${SEVERITY_CONFIG.High.border}`, borderRadius: "8px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: SEVERITY_CONFIG.High.color }}>{summary.highCount}</div>
              <div style={{ fontSize: "0.72rem", color: SEVERITY_CONFIG.High.color, textTransform: "uppercase", fontWeight: 700 }}>High</div>
            </div>
          )}
          {summary.mediumCount > 0 && (
            <div style={{ textAlign: "center", padding: "0.4rem 0.75rem", background: SEVERITY_CONFIG.Medium.bg, border: `1px solid ${SEVERITY_CONFIG.Medium.border}`, borderRadius: "8px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: SEVERITY_CONFIG.Medium.color }}>{summary.mediumCount}</div>
              <div style={{ fontSize: "0.72rem", color: SEVERITY_CONFIG.Medium.color, textTransform: "uppercase", fontWeight: 700 }}>Medium</div>
            </div>
          )}
          {summary.lowCount > 0 && (
            <div style={{ textAlign: "center", padding: "0.4rem 0.75rem", background: SEVERITY_CONFIG.Low.bg, border: `1px solid ${SEVERITY_CONFIG.Low.border}`, borderRadius: "8px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: SEVERITY_CONFIG.Low.color }}>{summary.lowCount}</div>
              <div style={{ fontSize: "0.72rem", color: SEVERITY_CONFIG.Low.color, textTransform: "uppercase", fontWeight: 700 }}>Low</div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs by Category */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
        <button
          type="button"
          aria-pressed={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
          style={{
            padding: "0.35rem 0.8rem",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "6px",
            border: activeCategory === "all" ? "1px solid #0284c7" : "1px solid #cbd5e1",
            background: activeCategory === "all" ? "#0284c7" : "#ffffff",
            color: activeCategory === "all" ? "#ffffff" : "#475569",
            cursor: "pointer",
          }}
        >
          All Categories ({findings.length})
        </button>
        {(["timeline_gap", "missing_information", "content_quality", "contradiction", "ats_technical"] as GapRiskCategory[]).map((cat) => {
          const count = findings.filter((f) => f.category === cat).length;
          if (count === 0 && activeCategory !== cat) return null;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "0.35rem 0.8rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                borderRadius: "6px",
                border: activeCategory === cat ? "1px solid #0284c7" : "1px solid #cbd5e1",
                background: activeCategory === cat ? "#0284c7" : "#ffffff",
                color: activeCategory === cat ? "#ffffff" : "#475569",
                cursor: "pointer",
              }}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Findings List or Clean Empty State */}
      {filteredFindings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "12px", margin: "1rem 0" }}>
          <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>✓</div>
          <h4 style={{ margin: "0 0 0.4rem 0", color: "#166534", fontSize: "1.1rem", fontWeight: 800 }}>
            {findings.length === 0
              ? "No advisory findings detected"
              : "No issues match the selected filter"}
          </h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#15803d", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
            {findings.length === 0
              ? "These checks found no items to review in the supplied resume."
              : "Try switching to another category tab to view other findings."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </section>
  );
}

function FindingCard({ finding }: { finding: GapRiskFinding }) {
  const sev = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.Low;
  const [expanded, setExpanded] = useState(true);

  return (
    <article
      style={{
        border: `1px solid ${sev.border}`,
        borderRadius: "10px",
        background: "#ffffff",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Finding Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "0.75rem 1rem",
          background: sev.bg,
          borderBottom: `1px solid ${sev.border}`,
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "0.74rem",
              fontWeight: 800,
              textTransform: "uppercase",
              background: "#ffffff",
              color: sev.color,
              border: `1px solid ${sev.border}`,
            }}
          >
            {sev.icon} {sev.label}
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "0.74rem",
              fontWeight: 700,
              background: "#f1f5f9",
              color: "#334155",
            }}
          >
            {CATEGORY_LABELS[finding.category]}
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "0.74rem",
              fontWeight: 700,
              background: "#e0f2fe",
              color: "#0369a1",
            }}
          >
            📍 {finding.pageLocation}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>
            Confidence: {finding.confidence}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "transparent",
              border: "none",
              color: "#475569",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 700,
              padding: "2px 6px",
            }}
          >
            {expanded ? "Collapse ▲" : "Expand ▼"}
          </button>
        </div>
      </div>

      {/* Finding Body */}
      {expanded && (
        <div style={{ padding: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
            {finding.title}
          </h4>

          {/* Evidence Excerpt */}
          {finding.evidenceExcerpt && (
            <blockquote
              style={{
                margin: "0.5rem 0 0.75rem 0",
                padding: "0.5rem 0.85rem",
                background: "#f8fafc",
                borderLeft: "3.5px solid #94a3b8",
                borderRadius: "0 6px 6px 0",
                fontSize: "0.85rem",
                color: "#334155",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              &ldquo;{finding.evidenceExcerpt}&rdquo;
            </blockquote>
          )}

          {/* Explanation */}
          <p style={{ margin: "0 0 0.6rem 0", fontSize: "0.88rem", color: "#334155", lineHeight: 1.5 }}>
            <strong>Finding:</strong> {finding.explanation}
          </p>

          {/* Why it Matters */}
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "6px",
              fontSize: "0.84rem",
              color: "#92400e",
              lineHeight: 1.45,
              marginBottom: "0.6rem",
            }}
          >
            <strong>Why it matters:</strong> {finding.whyItMatters}
          </div>

          {/* Recommended Action */}
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              fontSize: "0.84rem",
              color: "#166534",
              lineHeight: 1.45,
            }}
          >
            <strong>Recommended action:</strong> {finding.recommendedCorrection}
          </div>
        </div>
      )}
    </article>
  );
}
