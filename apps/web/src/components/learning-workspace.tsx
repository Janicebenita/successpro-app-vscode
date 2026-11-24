"use client";

import { fetchJsonWithDeadline } from "@/lib/client-json-request";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalProfile, CareerGoal } from "@successpro/contracts";
import type { AiTaskOutput } from "@successpro/contracts/ai";
import type { CourseCatalogEntry } from "@successpro/contracts/learning";

export function LearningWorkspace({ profile, goal, courses }: { profile: CanonicalProfile; goal: CareerGoal | null; courses: CourseCatalogEntry[] }) {
  const [targetRole, setTargetRole] = useState(goal?.targetRole || profile.targetRoles[0] || profile.currentRole || profile.experience[0]?.title || "");
  const [gaps, setGaps] = useState([goal?.targetSkill, ...((goal?.tasks ?? []).filter((task) => task.category === "skills" || task.category === "credentials").map((task) => task.label))].filter(Boolean).join(", "));
  const [onlyFree, setOnlyFree] = useState(false);
  const [result, setResult] = useState<AiTaskOutput<"recommendUpskilling"> | null>(null);
  const [status, setStatus] = useState("Studying your career profile and current learning sources…");
  const autoRequested = useRef(false);
  const visible = useMemo(() => onlyFree ? courses.filter((course) => course.free) : courses, [courses, onlyFree]);
  const recommend = useCallback(async () => {
    const gapList = gaps.split(",").map((item) => item.trim()).filter(Boolean);
    if (!targetRole) { setStatus("Add a current or target role to your profile to receive a learning plan."); return; }
    setStatus("Comparing your confirmed experience with relevant learning sources…");
    const availableCourses = visible.map((course) => ({ id: course.id, title: course.title, provider: course.provider, skills: course.skills, free: course.free, url: course.url, lastVerifiedOn: course.lastVerifiedOn }));
    const response = await fetchJsonWithDeadline("/api/ai/recommendUpskilling", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, targetRole, gaps: gapList, availableCourses }) });
    const body = await response.json();
    if (response.ok && body.meta.validation === "passed" && body.output.priorities.length) { setResult(body.output); setStatus("Your suggested learning plan is ready. Add a specific gap above to refine it."); }
    else if (response.ok) setStatus("Tailored learning guidance is unavailable right now. The current course catalog remains below; please retry shortly.");
    else setStatus(body.error ?? "Unable to prepare recommendations.");
  }, [gaps, profile, targetRole, visible]);
  useEffect(() => {
    if (autoRequested.current || !targetRole) return;
    autoRequested.current = true;
    void recommend();
  }, [targetRole, recommend]);
  const recommendedIds = new Set(result?.priorities.flatMap((item) => item.courseIds) ?? []);
  return <div className="learning-workspace">
    <section className="work-card profile-intro"><div><span className="status-pill">LEARNING PLAN</span><h2>Learning suggested for your next move</h2><p>We begin with your confirmed roles, skills, and career direction. Add a particular skill gap only if you want to refine the plan; course choices are assessed for relevance and current availability.</p></div><button className="button button-primary" type="button" onClick={() => void recommend()}>Refresh my learning plan</button></section>
    <section className="work-card form-grid"><div className="form-columns"><label className="form-field">Current or target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} /></label><label className="form-field">Specific skills to strengthen <span className="field-help">Optional; separate with commas</span><input value={gaps} onChange={(event) => setGaps(event.target.value)} /></label></div><label className="toggle-row"><span><strong>Show free courses only</strong><small>Turn off to compare free and paid options by relevance.</small></span><input type="checkbox" checked={onlyFree} onChange={(event) => setOnlyFree(event.target.checked)} /></label><p className="save-status" role="status">{status}</p></section>
    {result && <section className="work-card"><span className="section-kicker">YOUR PRIORITIES</span><div className="learning-priorities">{result.priorities.map((item) => <article key={item.skill}><h3>{item.skill}</h3><p>{item.reason}</p><strong>Practice it:</strong><p>{item.practiceProject}</p></article>)}</div>{result.caveats.map((item) => <p className="document-note" key={item}>{item}</p>)}</section>}
    <section className="course-grid">{visible.map((course) => <article className={`work-card course-card${recommendedIds.has(course.id) ? " recommended" : ""}`} key={course.id}>{recommendedIds.has(course.id) && <span className="status-pill">MATCHED TO YOUR PLAN</span>}<div className="card-heading"><div><span className="section-kicker">{course.provider}</span><h3>{course.title}</h3></div><span className={course.free ? "course-price free" : "course-price"}>{course.free ? "Free learning" : "Paid"}</span></div><p>{course.availabilityNote}</p>{course.affiliate && <p className="document-note"><strong>Partner-link disclosure:</strong> {course.affiliateDisclosure}</p>}<div className="course-facts"><span>{course.level.replace("-", " ")}</span><span>{course.duration}</span><span>{course.certificationType}</span><span>Checked {course.lastVerifiedOn}</span></div><div className="skill-cloud">{course.skills.slice(0, 7).map((skill) => <span key={skill}>{skill}</span>)}</div><a className="button button-dark" href={course.url} target="_blank" rel="noreferrer">Check current availability</a></article>)}</section>
  </div>;
}
