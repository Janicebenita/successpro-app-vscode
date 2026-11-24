// Read-only check that the local resume queue is idle before a worker reload.
// It never writes to Redis or MySQL and never prints connection credentials.
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { createClient } from "redis";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
);
const redisUrl = process.env.RESUME_REDIS_URL ?? env.RESUME_REDIS_URL ?? "redis://127.0.0.1:6380";
const mysqlUrl = process.env.RESUME_MYSQL_URL ?? env.RESUME_MYSQL_URL ?? "mysql://successpro:successpro@127.0.0.1:3307/successpro_local";

const redis = createClient({ url: redisUrl });
await redis.connect();
const ready = await redis.lLen("resume:native:ready");
const processing = await redis.lLen("resume:native:processing");
const retry = await redis.zCard("resume:native:retry");
await redis.quit();

const connection = await mysql.createConnection(mysqlUrl);
const [rows] = await connection.query("SELECT status, COUNT(*) AS count FROM resume_processing_jobs GROUP BY status");
const [[active]] = await connection.query("SELECT COUNT(*) AS count FROM resume_processing_jobs WHERE status = 'processing' AND lease_expires_at > NOW(6)");
await connection.end();

console.log(JSON.stringify({ redis: { ready, processing, retry }, mysqlByStatus: Object.fromEntries(rows.map((row) => [row.status, Number(row.count)])), mysqlActivelyProcessing: Number(active.count) }));
console.log(ready === 0 && processing === 0 && retry === 0 && Number(active.count) === 0 ? "QUEUE_CLEAR: safe to reload the worker" : "QUEUE_BUSY: do not reload the worker yet");
