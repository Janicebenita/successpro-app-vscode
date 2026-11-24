import { resumeDatabase } from "./resume-native/infrastructure";
import { adminDb } from "./firebase-admin";
import type { ResumeAnalysisInput, ResumeAnalysisResult } from "@successpro/contracts";
import type { AiTaskOutput, AiRunMeta } from "@successpro/contracts/ai";
import type { RowDataPacket } from "mysql2/promise";

export interface StoredReview {
  id: string;
  ownerId: string;
  input: ResumeAnalysisInput;
  result: ResumeAnalysisResult;
  assistant?: { output: AiTaskOutput<"analyzeResume">; meta: AiRunMeta } | null;
  status: string;
  createdAt?: unknown;
  completedAt?: unknown;
  detailedExplanations?: Record<string, unknown>;
  evalDedupeKey?: string;
  resumeHash?: string;
  originalFilename?: string;
  evaluationMode?: string;
  jobDescriptionHash?: string;
  atsScore?: number;
  rubricVersion?: string;
}

export interface PersistReviewOptions {
  evalDedupeKey?: string;
  resumeHash?: string;
  originalFilename?: string;
  evaluationMode?: string;
  jobDescriptionHash?: string;
  atsScore?: number;
  rubricVersion?: string;
}

export function localReviewPersistenceEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true" && process.env.RESUME_NATIVE_PIPELINE_ENABLED === "true";
}

let ready: Promise<unknown> | undefined;

async function ensure() {
  if (ready) return ready;
  ready = (async () => {
    const db = resumeDatabase();
    await db.query(`
      CREATE TABLE IF NOT EXISTS resume_review_assessments (
        id VARCHAR(128) PRIMARY KEY,
        owner_id VARCHAR(128) NOT NULL,
        processing_job_id CHAR(36) NULL,
        eval_dedupe_key VARCHAR(64) NULL,
        resume_hash VARCHAR(64) NULL,
        original_filename VARCHAR(255) NULL,
        evaluation_mode VARCHAR(32) NULL,
        job_description_hash VARCHAR(64) NULL,
        ats_score DECIMAL(5,2) NULL,
        rubric_version VARCHAR(32) NULL,
        payload JSON NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY ix_review_owner_created (owner_id, created_at),
        KEY ix_review_dedupe (owner_id, eval_dedupe_key),
        KEY ix_review_resume_hash (owner_id, resume_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // In case the table already existed without the extra columns
    const columns = [
      "ALTER TABLE resume_review_assessments ADD COLUMN eval_dedupe_key VARCHAR(64) NULL",
      "ALTER TABLE resume_review_assessments ADD COLUMN resume_hash VARCHAR(64) NULL",
      "ALTER TABLE resume_review_assessments ADD COLUMN original_filename VARCHAR(255) NULL",
      "ALTER TABLE resume_review_assessments ADD COLUMN evaluation_mode VARCHAR(32) NULL",
      "ALTER TABLE resume_review_assessments ADD COLUMN job_description_hash VARCHAR(64) NULL",
      "ALTER TABLE resume_review_assessments ADD COLUMN ats_score DECIMAL(5,2) NULL",
      "ALTER TABLE resume_review_assessments ADD COLUMN rubric_version VARCHAR(32) NULL",
    ];
    for (const q of columns) {
      try {
        await db.query(q);
      } catch {}
    }
    try {
      await db.query("DELETE FROM resume_review_assessments WHERE ats_score IS NOT NULL AND ats_score <= 15");
    } catch {}
    try {
      await db.query("ALTER TABLE resume_review_assessments ADD INDEX ix_review_dedupe (owner_id, eval_dedupe_key)");
    } catch {}
    try {
      await db.query("ALTER TABLE resume_review_assessments ADD INDEX ix_review_resume_hash (owner_id, resume_hash)");
    } catch {}
  })().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function findCachedReview(ownerId: string, evalDedupeKey: string): Promise<StoredReview | null> {
  if (localReviewPersistenceEnabled()) {
    try {
      await ensure();
      const [rows] = await resumeDatabase().query<RowDataPacket[]>(
        "SELECT payload FROM resume_review_assessments WHERE owner_id = ? AND eval_dedupe_key = ? ORDER BY created_at DESC LIMIT 1",
        [ownerId, evalDedupeKey]
      );
      if (rows[0]) {
        const item = payload(rows[0]);
        if (item && item.ownerId === ownerId && item.evalDedupeKey === evalDedupeKey) {
          return item;
        }
      }
    } catch (error) {
      console.warn("local_mysql_find_cached_review_failed", error);
    }
  }
  try {
    const snapshot = await adminDb
      .collection("analyses")
      .where("ownerId", "==", ownerId)
      .where("evalDedupeKey", "==", evalDedupeKey)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const data = doc.data() as StoredReview;
        if (data && data.ownerId === ownerId && data.evalDedupeKey === evalDedupeKey) {
          return { ...data, id: doc.id };
        }
      }
    }
  } catch {}
  return null;
}

export async function findBaselineResumeReview(ownerId: string, resumeHash: string): Promise<StoredReview | null> {
  if (localReviewPersistenceEnabled()) {
    try {
      await ensure();
      const [rows] = await resumeDatabase().query<RowDataPacket[]>(
        "SELECT payload FROM resume_review_assessments WHERE owner_id = ? AND resume_hash = ? ORDER BY created_at DESC LIMIT 1",
        [ownerId, resumeHash]
      );
      if (rows[0]) {
        const item = payload(rows[0]);
        if (item && item.ownerId === ownerId && item.resumeHash === resumeHash) {
          return item;
        }
      }
    } catch (error) {
      console.warn("local_mysql_find_baseline_review_failed", error);
    }
  }
  try {
    const snapshot = await adminDb
      .collection("analyses")
      .where("ownerId", "==", ownerId)
      .where("resumeHash", "==", resumeHash)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const data = doc.data() as StoredReview;
        if (data && data.ownerId === ownerId && data.resumeHash === resumeHash) {
          return { ...data, id: doc.id };
        }
      }
    }
  } catch {}
  return null;
}

export async function persistLocalReview(value: StoredReview, options?: PersistReviewOptions) {
  if (!localReviewPersistenceEnabled()) return;
  await ensure();
  const createdAt = new Date().toISOString();
  const completedAt = value.status === "completed" ? createdAt : null;
  const fullValue: StoredReview = {
    ...value,
    evalDedupeKey: options?.evalDedupeKey,
    resumeHash: options?.resumeHash,
    originalFilename: options?.originalFilename,
    evaluationMode: options?.evaluationMode,
    jobDescriptionHash: options?.jobDescriptionHash,
    atsScore: options?.atsScore,
    rubricVersion: options?.rubricVersion,
    createdAt,
    completedAt,
  };
  await resumeDatabase().execute(
    `INSERT INTO resume_review_assessments 
     (id, owner_id, processing_job_id, eval_dedupe_key, resume_hash, original_filename, evaluation_mode, job_description_hash, ats_score, rubric_version, payload) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), eval_dedupe_key = VALUES(eval_dedupe_key), ats_score = VALUES(ats_score)`,
    [
      value.id,
      value.ownerId,
      value.input.processingJobId ?? null,
      options?.evalDedupeKey ?? null,
      options?.resumeHash ?? null,
      options?.originalFilename ?? null,
      options?.evaluationMode ?? null,
      options?.jobDescriptionHash ?? null,
      options?.atsScore ?? null,
      options?.rubricVersion ?? null,
      JSON.stringify(fullValue),
    ]
  );
}

function payload(row: RowDataPacket): StoredReview {
  return typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload as StoredReview);
}

export async function loadReview(id: string, ownerId: string): Promise<StoredReview | null> {
  if (localReviewPersistenceEnabled()) {
    await ensure();
    const [rows] = await resumeDatabase().query<RowDataPacket[]>(
      "SELECT payload FROM resume_review_assessments WHERE id = ? AND owner_id = ? LIMIT 1",
      [id, ownerId]
    );
    if (rows[0]) return payload(rows[0]);
  }
  const snapshot = await adminDb.collection("analyses").doc(id).get();
  const value = snapshot.data();
  return snapshot.exists && value?.ownerId === ownerId ? ({ ...value, id: snapshot.id } as StoredReview) : null;
}

export async function listReviews(ownerId: string): Promise<StoredReview[]> {
  if (localReviewPersistenceEnabled()) {
    await ensure();
    const [rows] = await resumeDatabase().query<RowDataPacket[]>(
      "SELECT payload FROM resume_review_assessments WHERE owner_id = ? ORDER BY created_at DESC LIMIT 10",
      [ownerId]
    );
    return rows.map(payload);
  }
  const snapshot = await adminDb.collection("analyses").where("ownerId", "==", ownerId).limit(10).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as StoredReview);
}
