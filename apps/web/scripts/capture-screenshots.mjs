import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const outputDir = resolve(process.cwd(), "../../docs/screenshots");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const captures = [
  ["desktop-landing", "/", { width: 1440, height: 1000 }],
  ["desktop-login", "/login", { width: 1440, height: 1000 }],
  ["desktop-dashboard", "/dashboard", { width: 1440, height: 1000 }],
  ["desktop-admin", "/admin", { width: 1440, height: 1000 }],
  ["mobile-landing", "/", { width: 390, height: 844 }],
  ["mobile-signup", "/signup", { width: 390, height: 844 }],
  ["mobile-dashboard", "/dashboard", { width: 390, height: 844 }],
  ["mobile-admin", "/admin", { width: 390, height: 844 }],
];

for (const [name, path, viewport] of captures) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: name.startsWith("mobile-") });
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(outputDir, `${name}.png`), fullPage: true });
  await page.close();
}

for (const [name, viewport] of [["desktop-review", { width: 1440, height: 1000 }], ["mobile-review", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: name.startsWith("mobile-") });
  await page.goto(`${baseURL}/review`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run strict review" }).click();
  await page.screenshot({ path: resolve(outputDir, `${name}.png`), fullPage: true });
  await page.close();
}

await browser.close();
