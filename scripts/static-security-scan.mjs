import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "apps/web/src");
const findings = [];
const rules = [
  ["dangerous HTML injection", /dangerouslySetInnerHTML/g],
  ["dynamic code execution", /\beval\s*\(|\bnew\s+Function\s*\(/g],
  ["shell command execution", /\b(?:exec|execSync)\s*\(/g],
  ["weak hash for security-sensitive data", /createHash\s*\(\s*["'](?:md5|sha1)["']/gi],
];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(fullPath);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      const content = await readFile(fullPath, "utf8");
      for (const [label, pattern] of rules) {
        for (const match of content.matchAll(pattern)) {
          const line = content.slice(0, match.index).split("\n").length;
          findings.push(`${path.relative(process.cwd(), fullPath)}:${line}: ${label}`);
        }
      }
    }
  }
}

await scan(root);
if (findings.length) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Static security scan passed.\n");
