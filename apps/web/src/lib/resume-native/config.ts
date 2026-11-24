import path from "node:path";

export const NATIVE_REJECTION_MESSAGE = "Please upload a digital PDF or DOCX containing selectable text.";

function integer(name: string, fallback: number, minimum = 1) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

export function nativeResumeEnabled() {
  return process.env.RESUME_NATIVE_PIPELINE_ENABLED === "true";
}

export function nativeConfig() {
  const repositoryRoot = path.resolve(process.cwd(), "..", "..");
  return {
    storageRoot: path.resolve(process.env.RESUME_LOCAL_STORAGE_ROOT ?? path.join(repositoryRoot, ".local", "resumes")),
    temporaryRoot: path.resolve(process.env.RESUME_TEMP_ROOT ?? path.join(repositoryRoot, ".local", "resume-temp")),
    maximumBytes: integer("RESUME_MAX_FILE_SIZE_MB", 20) * 1024 * 1024,
    maximumPages: integer("RESUME_MAX_PAGES", 25),
    chunkPages: integer("RESUME_CHUNK_PAGES", 5),
    processingTimeoutSeconds: integer("RESUME_PROCESSING_TIMEOUT_SECONDS", 900),
    maximumRetries: integer("RESUME_MAX_RETRIES", 3),
    mysqlUri: process.env.RESUME_MYSQL_URL ?? "mysql://successpro:successpro@127.0.0.1:3306/successpro_local",
    redisUrl: process.env.RESUME_REDIS_URL ?? "redis://127.0.0.1:6379",
  };
}

export function localDevelopmentOwnerId() {
  if (process.env.NODE_ENV === "production") return null;
  const value = process.env.RESUME_NATIVE_LOCAL_USER_ID?.trim();
  return value || null;
}

export function retryDelaySeconds(attempt: number) {
  return Math.min(300, 2 ** Math.max(0, attempt - 1) * 5);
}

