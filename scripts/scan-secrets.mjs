import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".next", ".pnpm-store", "node_modules", "output", "test-results", "playwright-report", "tmp"]);
const ignoredFiles = new Set(["pnpm-lock.yaml", "scan-secrets.mjs"]);
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yaml", ".yml", ".md", ".sh", ".env", ".example"]);
const signatures = [
  ["private key", new RegExp(["BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY"].join(""), "i")],
  ["Google API key", new RegExp(["AI", "za[0-9A-Za-z_-]{30,}"].join(""))],
  ["GitHub token", new RegExp(["gh", "[pousr]_[0-9A-Za-z]{30,}"].join(""))],
  ["OpenAI-style key", new RegExp(["s", "k-(?:live-)?[0-9A-Za-z_-]{24,}"].join(""))],
  ["Razorpay live key", new RegExp(["rzp_", "live_[0-9A-Za-z]{12,}"].join(""), "i")],
  ["Slack token", new RegExp(["xox", "[abprs]-[0-9A-Za-z-]{20,}"].join(""))],
];

async function filesIn(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesIn(fullPath));
    else if (!ignoredFiles.has(entry.name) && (allowedExtensions.has(path.extname(entry.name)) || entry.name.startsWith(".env"))) found.push(fullPath);
  }
  return found;
}

const findings = [];
for (const file of await filesIn(root)) {
  const relative = path.relative(root, file);
  if (/^apps\/web\/\.env(?:\.|$)/.test(relative) && !relative.endsWith(".example")) continue;
  const content = await readFile(file, "utf8").catch(() => "");
  for (const [label, pattern] of signatures) {
    const unsafeLines = content.split("\n").filter((line) => !line.includes("NEXT_PUBLIC_FIREBASE_API_KEY=")).join("\n");
    if (pattern.test(unsafeLines)) findings.push(`${relative}: possible ${label}`);
  }
}
if (findings.length) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Secret scan passed.\n");
