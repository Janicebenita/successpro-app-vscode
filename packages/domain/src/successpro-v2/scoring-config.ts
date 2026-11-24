import type { EvaluationMode, PillarId } from "./types";

export const TOTAL_MAX_POINTS = 100;

export const PILLAR_MAX_WITH_JD: Record<PillarId, number> = {
  content: 50,
  visual: 25,
  jobMatch: 25,
};

export const PILLAR_MAX_NO_JD: Record<PillarId, number> = {
  content: 65,
  visual: 35,
  jobMatch: 0,
};

export const NO_JD_MULTIPLIERS: Record<PillarId, number> = {
  content: 1.3,
  visual: 1.4,
  jobMatch: 0,
};

export function getPillarMaximum(pillar: PillarId, mode: EvaluationMode): number {
  return mode === "with_job_description" ? PILLAR_MAX_WITH_JD[pillar] : PILLAR_MAX_NO_JD[pillar];
}
