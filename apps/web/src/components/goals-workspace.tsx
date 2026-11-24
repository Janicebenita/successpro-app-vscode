"use client";

import { fetchJsonWithDeadline } from "@/lib/client-json-request";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanonicalProfile, CareerGoal } from "@successpro/contracts";
import type { AiTaskOutput } from "@successpro/contracts/ai";
import { goalSuggestionFromProfile } from "@/lib/profile-suggestions";

const categories: Array<{ key: CareerGoal["tasks"][number]["category"]; label: string }> = [
  { key: "skills", label: "Skills" }, { key: "experience", label: "Experience" }, { key: "portfolio", label: "Portfolio" }, { key: "credentials", label: "Credentials" }, { key: "network", label: "Network" }, { key: "resume", label: "Resume & LinkedIn" }, { key: "role", label: "Role strategy" },
];

function task(label: string, category: CareerGoal["tasks"][number]["category"], index: number) {
  return { id: `task-${index + 1}`, label, category, targetMonth: "", completed: false };
}

function defaultTasks(profile?: Partial<CanonicalProfile> | null) {
  const skill = profile?.skills?.[0] || "one priority skill";
  return [task("Explore the skills and responsibilities of your target role", "role", 0), task(`Practise ${skill} through a relevant project`, "skills", 1), task("Choose a project that demonstrates your strengths", "portfolio", 2), task("Update your resume and LinkedIn with your recent achievements", "resume", 3), task("Speak with two people working in your target role", "network", 4)];
}

export function GoalsWorkspace({ initial, profile }: { initial?: Partial<CareerGoal> | null; profile?: CanonicalProfile | null }) {
  const suggested = profile ? goalSuggestionFromProfile(profile) : null;
  const [goal, setGoal] = useState<CareerGoal>({
    targetRole: initial?.targetRole ?? suggested?.targetRole ?? "", targetDate: initial?.targetDate ?? "", motivation: initial?.motivation ?? "", targetSalary: initial?.targetSalary ?? null, currency: initial?.currency ?? suggested?.currency ?? "INR", targetCompany: initial?.targetCompany ?? "", targetIndustry: initial?.targetIndustry ?? profile?.industry ?? "", targetGeography: initial?.targetGeography ?? profile?.location ?? "", targetSkill: initial?.targetSkill ?? "",
    tasks: initial?.tasks?.map((item, index) => ({ ...item, category: item.category ?? "role", targetMonth: item.targetMonth ?? "", id: item.id || `task-${index + 1}` })) ?? defaultTasks(profile),
  });
  const [status, setStatus] = useState("Turn your target into a practical plan you can review each month.");
  const [planAdvice, setPlanAdvice] = useState<AiTaskOutput<"careerGapPlan"> | null>(null);
  const autoRequested = useRef(false);
  const complete = goal.tasks.filter((item) => item.completed).length;
  const progress = goal.tasks.length ? Math.round((complete / goal.tasks.length) * 100) : 0;
  const targetDetails = [goal.targetIndustry, goal.targetGeography].filter(Boolean);

  function updateTask(id: string, patch: Partial<CareerGoal["tasks"][number]>) { setGoal((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, ...patch } : item) })); }
  function addTask() { setGoal((current) => ({ ...current, tasks: [...current.tasks, { id: crypto.randomUUID(), label: "", category: "role", targetMonth: "", completed: false }] })); }
  function rebuildPlan() {
    const role = goal.targetRole || "your target role"; const skill = goal.targetSkill || "one priority skill for the role"; const market = goal.targetCompany || goal.targetIndustry || "the target market";
    setGoal((current) => ({ ...current, tasks: [task(`Explore current ${role} openings and note the common requirements`, "role", 0), task(`Build a learning plan for ${skill}`, "skills", 1), task("Find a work or volunteer project that builds relevant experience", "experience", 2), task(`Prepare one project example relevant to ${role}`, "portfolio", 3), task(`Consider a useful qualification for ${skill}`, "credentials", 4), task(`Speak with two people familiar with ${market}`, "network", 5), task(`Update your resume and LinkedIn for ${role}`, "resume", 6)] }));
    setStatus("Your action plan is ready. Adjust any step, then save.");
  }
  const tailorPlan = useCallback(async (replaceTasks = true) => {
    if (!profile || !goal.targetRole) { setStatus("Add a current or target role to your profile before preparing tailored guidance."); return; }
    setStatus("Studying your confirmed experience and preparing suggested next steps…");
    const response = await fetchJsonWithDeadline("/api/ai/careerGapPlan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, goal }) });
    const body = await response.json();
    if (!response.ok) { setStatus(body.error ?? "Unable to build a tailored plan."); return; }
    if (body.meta.validation !== "passed") { setStatus("Tailored guidance is unavailable for now. Your existing actions are unchanged; you can try again."); return; }
    const gapTasks = body.output.gaps.map((gap: { category: CareerGoal["tasks"][number]["category"]; suggestion: string }) => ({ id: crypto.randomUUID(), label: gap.suggestion, category: gap.category, targetMonth: "", completed: false }));
    const milestoneTasks = body.output.milestones.map((milestone: { action: string; month: string }) => ({ id: crypto.randomUUID(), label: milestone.action, category: "role" as const, targetMonth: /^\d{4}-\d{2}$/.test(milestone.month) ? milestone.month : "", completed: false }));
    const unique = [...gapTasks, ...milestoneTasks].filter((item, index, items) => items.findIndex((candidate) => candidate.label.toLowerCase() === item.label.toLowerCase()) === index).slice(0, 30);
    setPlanAdvice(body.output);
    if (replaceTasks && unique.length) setGoal((current) => ({ ...current, tasks: unique }));
    setStatus(replaceTasks ? "Your suggested plan is ready. Adjust the actions to your circumstances, then save." : "Fresh suggestions from your profile are ready below. Your saved actions were not changed.");
  }, [profile, goal]);
  useEffect(() => {
    if (autoRequested.current || !profile || !goal.targetRole) return;
    autoRequested.current = true;
    void tailorPlan(!initial?.targetRole);
  }, [profile, goal.targetRole, initial?.targetRole, tailorPlan]);
  async function save() { setStatus("Saving…"); const response = await fetchJsonWithDeadline("/api/goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(goal) }); const body = await response.json(); setStatus(response.ok ? "Goal and action plan saved." : body.error ?? "Unable to save this goal."); }

  return <div className="goal-workspace">
    <section className="work-card profile-intro"><div><span className="status-pill">CAREER DIRECTION</span><h2>A suggested path from your career profile</h2><p>We start with your current experience and any target role already in your profile. Adjust the direction, pay, location, or timing only if you want to; your saved actions remain yours.</p></div><button className="button button-primary" onClick={() => void save()}>Save goal</button></section>
    <section className="profile-grid">
      <article className="work-card form-grid goal-target-form"><div><span className="section-kicker">YOUR DIRECTION</span><h3>Your next move</h3><p>Start with a role and location. We will suggest steps from your profile; you can refine them at any time.</p></div><label className="form-field">Role you want next<input value={goal.targetRole} onChange={(event) => setGoal({ ...goal, targetRole: event.target.value })} placeholder="For example, Product Lead" /></label><label className="form-field">Where you want to work<input value={goal.targetGeography} onChange={(event) => setGoal({ ...goal, targetGeography: event.target.value })} placeholder="City, region, or country" /></label><details className="goal-more-options"><summary>Refine my goal <span>Optional details</span></summary><div className="form-columns"><label className="form-field">Preferred company<input value={goal.targetCompany} onChange={(event) => setGoal({ ...goal, targetCompany: event.target.value })} placeholder="Optional" /></label><label className="form-field">Industry<input value={goal.targetIndustry} onChange={(event) => setGoal({ ...goal, targetIndustry: event.target.value })} /></label></div><label className="form-field">Skill to develop<input value={goal.targetSkill} onChange={(event) => setGoal({ ...goal, targetSkill: event.target.value })} /></label><div className="form-columns"><label className="form-field">Pay goal<input type="number" min="0" value={goal.targetSalary ?? ""} onChange={(event) => setGoal({ ...goal, targetSalary: event.target.value ? Number(event.target.value) : null })} /></label><label className="form-field">Currency<select value={goal.currency} onChange={(event) => setGoal({ ...goal, currency: event.target.value })}>{["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD"].map((currency) => <option key={currency}>{currency}</option>)}</select></label></div><label className="form-field">When would you like to get there?<input type="date" value={goal.targetDate} onChange={(event) => setGoal({ ...goal, targetDate: event.target.value })} /></label><label className="form-field">What matters most to you?<textarea rows={3} value={goal.motivation} onChange={(event) => setGoal({ ...goal, motivation: event.target.value })} placeholder="Optional" /></label></details><div className="goal-plan-actions"><button className="button button-dark" type="button" onClick={() => void tailorPlan()} disabled={!goal.targetRole}>Suggest my next steps</button><button className="text-button" type="button" onClick={rebuildPlan} disabled={!goal.targetRole}>Start with a simple plan</button></div><p className="save-status" role="status">{status}</p></article>
      <aside className="work-card goal-dashboard" aria-label="Goal progress summary"><span className="section-kicker">YOUR PATH</span><div className="goal-progress"><strong>{progress}%</strong><span>{complete} of {goal.tasks.length} actions complete</span><i><b style={{ width: `${progress}%` }} /></i></div><div className="goal-target-card"><span>Working toward</span><strong>{goal.targetRole || "Add a target role"}</strong>{targetDetails.length > 0 && <small>{targetDetails.join(" · ")}</small>}{goal.targetDate && <small>Target date · {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(`${goal.targetDate}T00:00:00`))}</small>}</div><div className="goal-category-summary">{categories.filter((category) => goal.tasks.some((item) => item.category === category.key)).map((category) => <span key={category.key}><b>{goal.tasks.filter((item) => item.category === category.key).length}</b>{category.label}</span>)}</div></aside>
    </section>
    {planAdvice && <section className="work-card goal-guidance"><span className="section-kicker">PERSONAL GUIDANCE</span><h3>Where to focus</h3><p>{planAdvice.summary}</p><div className="learning-priorities">{planAdvice.gaps.map((gap, index) => <article key={`${gap.category}-${index}`}><span className="section-kicker">{gap.category}</span><h3>{gap.suggestion}</h3><details><summary>Why we suggest this</summary><p>{gap.observed}</p><p>{gap.inference}</p></details></article>)}</div>{planAdvice.intermediateRoles.length > 0 && <p><strong>Roles that could help you get there:</strong> {planAdvice.intermediateRoles.join(", ")}</p>}</section>}
    <section className="work-card form-grid"><div className="card-heading"><div><span className="section-kicker">YOUR ACTION PLAN</span><h3>Small steps, steady progress</h3><p>Tick off a step as you finish it. Edit or add actions whenever you need to.</p></div><button className="text-button" type="button" onClick={addTask}>Add action</button></div>{goal.tasks.map((item, index) => <div className="goal-task-editor" key={item.id}><label className="goal-task-check" aria-label={`Mark action ${index + 1} complete`}><input type="checkbox" checked={item.completed} onChange={(event) => updateTask(item.id, { completed: event.target.checked })} /><span>{String(index + 1).padStart(2, "0")}</span></label><label className="form-field">Action<textarea rows={Math.min(5, Math.max(2, Math.ceil(item.label.length / 40)))} value={item.label} onChange={(event) => updateTask(item.id, { label: event.target.value })} /></label><details className="goal-task-options"><summary>Options</summary><div className="form-columns"><label className="form-field">Area<select value={item.category} onChange={(event) => updateTask(item.id, { category: event.target.value as CareerGoal["tasks"][number]["category"] })}>{categories.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label><label className="form-field">Target month<input type="month" value={item.targetMonth} onChange={(event) => updateTask(item.id, { targetMonth: event.target.value })} /></label></div><button className="text-button danger-text" type="button" onClick={() => setGoal((current) => ({ ...current, tasks: current.tasks.filter((taskItem) => taskItem.id !== item.id) }))}>Remove action</button></details></div>)}</section>
  </div>;
}
