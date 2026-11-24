import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch();
const base = process.env.QA_BASE_URL || "https://successpro-web-staging-tjx6xu7doq-el.a.run.app";
await mkdir("../../output/ui/public-theme", { recursive: true });
try {
  for (const width of [390, 1440]) for (const route of ["", "login", "signup", "pricing"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(`${base}/${route}`, { waitUntil: "networkidle" });
    if (!process.env.QA_DEPLOYED) await page.addStyleTag({ content: await readFile("src/app/presentation.css", "utf8") });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow: ${route} ${width}`);
    if (process.env.QA_DEPLOYED && (await page.locator("body").innerText()).includes("\u2014")) throw new Error(`Em dash in public copy: ${route}`);
    await page.screenshot({ path: `../../output/ui/public-theme/${route || "home"}-${width}.png`, fullPage: true });
    await page.close();
  }
  console.log("Public desktop and phone overflow checks passed.");
} finally { await browser.close(); }
