// Isolated visual fixture: no authentication bypass and no customer data.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { baseProfile } from "./generate-document-goldens";
import { CareerPortrait } from "../src/components/career-portrait";
import { AppShell } from "../src/components/app-shell";
import { SiteFooter } from "../src/components/site-footer";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

Object.assign(globalThis, { React });
const css = await readFile("src/app/globals.css", "utf8") + await readFile("src/app/presentation.css", "utf8");
const router = { bfcacheId: "visual-fixture", back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {}, hmrRefresh() {} };
const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}><AppShell><CareerPortrait profile={baseProfile} publicProfileId="sp-0000000000000000" /></AppShell><SiteFooter /></AppRouterContext.Provider>);
await mkdir("../../output/ui", { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(`<html lang="en"><head><style>${css}</style></head><body>${html}</body></html>`);
    await page.screenshot({ path: `../../output/ui/career-${name}.png`, fullPage: true });
    const metrics = await page.evaluate(() => {
      const footer = document.querySelector("footer")!.getBoundingClientRect();
      const nav = document.querySelector(".sidebar-nav")!.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, navigationBottom: nav.bottom, footerTop: footer.top, educationVisible: [...document.querySelectorAll(".career-milestone small")].some((n) => n.textContent === "Education") };
    });
    console.log(name, metrics);
    if (metrics.overflow || !metrics.educationVisible || (name === "desktop" && metrics.navigationBottom > metrics.footerTop)) throw new Error(`${name} layout regression`);
    if (name === "mobile") {
      await page.getByText("Explore your workspace", { exact: true }).click();
      const navigation = page.getByRole("navigation", { name: "Mobile workspace navigation" });
      if (!await navigation.isVisible() || await navigation.getByRole("link").count() !== 17) throw new Error("Mobile menu must expose every customer tool");
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Expanded mobile menu overflows");
      await page.screenshot({ path: "../../output/ui/career-mobile-menu.png" });
    }
    await page.close();
  }
} finally { await browser.close(); }
