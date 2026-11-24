import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { createClient, type RedisClientType } from "redis";
import { processingRevision } from "../resume-runtime";
import { nativeConfig } from "./config";

let pool: Pool | undefined;
let redis: RedisClientType | undefined;

export type NativeJobStatus = "queued" | "processing" | "awaiting_review" | "completed" | "failed" | "dead_letter" | "cancelled";
export type NativeJobRow = RowDataPacket & { id: string; owner_id: string; status: NativeJobStatus; attempt_count: number; original_name: string; extracted_result: string | null; ai_result: string | null; confirmed_result: string | null; error_message: string | null; created_at: Date; updated_at: Date };

export function resumeDatabase() {
  pool ??= mysql.createPool({ uri: nativeConfig().mysqlUri, connectionLimit: 5, enableKeepAlive: true });
  return pool;
}

export async function resumeQueue() {
  if (!redis) {
    redis = createClient({ url: nativeConfig().redisUrl });
    redis.on("error", (error) => console.error("resume-native-redis", error));
    await redis.connect();
  }
  return redis;
}

export async function saveOriginal(ownerId: string, file: File, bytes: Uint8Array) {
  const id = randomUUID();
  const isPdf = bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
  const extension = file.name.toLowerCase().endsWith(".pdf") || isPdf ? ".pdf" : ".docx";
  const ownerSegment = createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
  const directory = path.resolve(nativeConfig().storageRoot, ownerSegment, id);
  const root = path.resolve(nativeConfig().storageRoot);
  if (directory !== root && !directory.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe local storage path");
  await mkdir(directory, { recursive: true });
  const objectPath = path.join(directory, `original${extension}`);
  await writeFile(objectPath, bytes, { flag: "wx" });
  return { id, objectPath, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function createAndEnqueueJob(input: { id: string; ownerId: string; objectPath: string; originalName: string; mimeType: string; size: number; sha256: string; pageCount: number | null }) {
  const db = resumeDatabase();
  const queue = await resumeQueue();
  const idempotencyKey = createHash("sha256").update(`${input.ownerId}:${input.sha256}:${await processingRevision()}`).digest("hex");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO resume_processing_jobs (id, owner_id, idempotency_key, status, original_path, original_name, mime_type, file_size, sha256, page_count, max_attempts, processing_timeout_seconds)
       VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [input.id, input.ownerId, idempotencyKey, input.objectPath, input.originalName, input.mimeType, input.size, input.sha256, input.pageCount, nativeConfig().maximumRetries, nativeConfig().processingTimeoutSeconds],
    );
    const [rows] = await connection.query<(RowDataPacket & { id: string; status: NativeJobStatus })[]>("SELECT id, status FROM resume_processing_jobs WHERE owner_id = ? AND idempotency_key = ?", [input.ownerId, idempotencyKey]);
    const job = rows[0];
    await connection.commit();
    const dedupe = await queue.set(`resume:native:enqueued:${job.id}`, "1", { NX: true, EX: nativeConfig().processingTimeoutSeconds * 2 });
    if (dedupe) await queue.lPush("resume:native:ready", JSON.stringify({ jobId: job.id, enqueuedAt: new Date().toISOString() }));
    return { id: job.id, status: job.status, duplicate: job.id !== input.id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ownedJob(jobId: string, ownerId: string) {
  const [rows] = await resumeDatabase().query<NativeJobRow[]>("SELECT * FROM resume_processing_jobs WHERE id = ? AND owner_id = ? LIMIT 1", [jobId, ownerId]);
  return rows[0] ?? null;
}

export async function latestOwnedJob(ownerId: string) {
  try {
    const [rows] = await resumeDatabase().query<NativeJobRow[]>(
      "SELECT * FROM resume_processing_jobs WHERE owner_id = ? AND status IN ('awaiting_review', 'completed') ORDER BY created_at DESC LIMIT 1",
      [ownerId]
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export function parseStoredJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value) as unknown; } catch { return null; }
  }
  return null;
}


export async function requeueVisualInspection(job: NativeJobRow, ownerId: string) {
  const queue = await resumeQueue();
  const db = resumeDatabase();
  const [updated] = await db.execute<ResultSetHeader>(
    "UPDATE resume_processing_jobs SET status = 'queued', attempt_count = 0, lease_owner = NULL, lease_expires_at = NULL, error_message = NULL WHERE id = ? AND owner_id = ? AND status = ?",
    [job.id, ownerId, job.status],
  );
  if (!updated.affectedRows) return;
  try {
    await queue.lPush("resume:native:ready", JSON.stringify({ jobId: job.id, enqueuedAt: new Date().toISOString() }));
  } catch (error) {
    await db.execute(
      "UPDATE resume_processing_jobs SET status = ?, attempt_count = ? WHERE id = ? AND owner_id = ? AND status = 'queued'",
      [job.status, job.attempt_count, job.id, ownerId],
    );
    throw error;
  }
}
