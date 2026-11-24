import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { CareerPortrait } from "../src/components/career-portrait";
import { PublicPortrait } from "../src/components/public-portrait";
import { baseProfile } from "./generate-document-goldens";
import { publicProfileProjection } from "../src/lib/public-profile";

const css = await readFile("src/app/globals.css", "utf8") + await readFile("src/app/presentation.css", "utf8");
const browser = await chromium.launch();
await mkdir("../../output/ui/membership", { recursive: true });
try {
  for (const premium of [false, true]) for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const profile = { ...baseProfile, openToWork: true };
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><main class="workspace">${renderToStaticMarkup(<CareerPortrait profile={profile} premium={premium} />)}</main></body></html>`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Portrait overflow at ${width}`);
    await page.screenshot({ path: `../../output/ui/membership/${premium ? "paid" : "free"}-${width}.png`, fullPage: true });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><main class="public-profile-page public-edition-${premium ? "signature" : "essential"}"><div class="public-profile-wrap">${renderToStaticMarkup(<PublicPortrait profile={publicProfileProjection(profile)} premium={premium} />)}</div></main></body></html>`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Public portrait overflow at ${width}`);
    await page.screenshot({ path: `../../output/ui/membership/public-${premium ? "paid" : "free"}-${width}.png`, fullPage: true });
    await page.close();
  }
  console.log("Eight free/paid, desktop/mobile, private/public portrait renders passed overflow checks.");
} finally { await browser.close(); }
