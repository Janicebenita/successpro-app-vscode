import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const browser = await chromium.launch();
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const path of ["/", "/dashboard", "/admin"]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    console.log(`${viewport.width}px ${path}`);
    for (const violation of violations) {
      console.log(`  ${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    }
    await context.close();
  }
}
await browser.close();
