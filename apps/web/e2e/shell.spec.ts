import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing page exposes the primary journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /turn your career history/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /check my resume/i })).toBeVisible();
});

test("public and operational screens render", async ({ page }) => {
  for (const path of ["/login", "/signup", "/pricing", "/admin"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }
});

test("registration requires explicit terms and automated-processing approval", async ({ page }) => {
  await page.goto("/signup");
  const create = page.getByRole("button", { name: "Create free account" });
  await expect(create).toBeDisabled();
  const confirmations = page.getByRole("checkbox");
  await expect(confirmations).toHaveCount(3);
  await confirmations.nth(0).check();
  await expect(create).toBeDisabled();
  await confirmations.nth(1).check();
  await expect(create).toBeDisabled();
  await confirmations.nth(2).check();
  await expect(create).toBeEnabled();
});

test("partners have separate sign-in journeys", async ({ page }) => {
  for (const [path, title] of [["recruiter", "Recruiter sign in"], ["mentor", "Mentor sign in"]]) {
    await page.goto(`/${path}`);
    await expect(page).toHaveURL(new RegExp(`/${path}/login\\?returnTo=/${path}$`));
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", `/signup?returnTo=%2F${path}`);
    await expect(page.getByRole("navigation", { name: "Application navigation" })).toHaveCount(0);
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(new RegExp(`/signup\\?returnTo=%2F${path}$`));
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${path}/login\\?returnTo=%2F${path}$`));
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("private workspaces preserve the intended destination", async ({ page }) => {
  for (const path of ["/dashboard", "/review", "/documents", "/profile", "/goals", "/linkedin", "/salary", "/learning", "/opportunities", "/messages", "/billing", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${path.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
});

test("malformed public profile identifiers are not exposed", async ({ page }) => {
  const response = await page.goto("/p/not-a-valid-profile-id");
  expect(response?.status()).toBe(404);
});

test("profile contact creation requires authentication", async ({ request }) => {
  const response = await request.post("/api/conversations", { data: { publicProfileId: "sp-0000000000000000", message: "A sufficiently long private introduction message." } });
  expect(response.status()).toBe(401);
});

test("private messages require authentication", async ({ request }) => {
  const response = await request.get("/api/conversations");
  expect(response.status()).toBe(401);
});

test("public-link rotation requires authentication", async ({ request }) => {
  const response = await request.post("/api/profile/public-link");
  expect(response.status()).toBe(401);
});

test("document downloads require authentication", async ({ request }) => {
  const requestBody = { templateId: "clarity", pageSize: "a4", contact: { email: "candidate@example.com", phone: "", location: "", linkedIn: "", website: "" } };
  expect((await request.post("/api/documents/resume", { data: requestBody })).status()).toBe(401);
  expect((await request.post("/api/documents/cover-letter", { data: requestBody })).status()).toBe(401);
});

test("document drafts and detailed review reports require authentication", async ({ request }) => {
  expect((await request.get("/api/document-drafts")).status()).toBe(401);
  expect((await request.put("/api/document-drafts", { data: {} })).status()).toBe(401);
  expect((await request.get("/api/document-drafts/versions")).status()).toBe(401);
  expect((await request.get("/api/reviews/not-owned/report")).status()).toBe(401);
  expect((await request.post("/api/reviews/not-owned/explain", { data: {} })).status()).toBe(401);
});

test("LinkedIn PDF comparison requires authentication", async ({ request }) => {
  expect((await request.post("/api/linkedin-profile", { multipart: {} })).status()).toBe(401);
});

test("salary research requires authentication", async ({ request }) => {
  expect((await request.get("/api/salary")).status()).toBe(401);
  expect((await request.put("/api/salary", { data: {} })).status()).toBe(401);
});

test("AI assistance requires authentication", async ({ request }) => {
  expect((await request.post("/api/ai/analyzeResume", { data: {} })).status()).toBe(401);
});

test("registration consent requires a verified identity token", async ({ request }) => {
  expect((await request.post("/api/registration-consent", { data: { adultAndTermsAccepted: true, automatedCareerProcessingAccepted: true } })).status()).toBe(401);
  expect((await request.get("/api/account/ai-consent")).status()).toBe(401);
  expect((await request.post("/api/account/ai-consent")).status()).toBe(401);
});

test("account data export requires authentication", async ({ request }) => {
  expect((await request.get("/api/account/export")).status()).toBe(401);
});

test("privacy lifecycle actions require a recently confirmed identity", async ({ request }) => {
  expect((await request.delete("/api/account/consent")).status()).toBe(401);
  expect((await request.delete("/api/account")).status()).toBe(401);
});

test("session-cookie mutations reject cross-origin requests centrally", async ({ request }) => {
  const response = await request.post("/api/profile", { headers: { Cookie: "successpro_session=synthetic-session", Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" }, data: {} });
  expect(response.status()).toBe(403);
  expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
});

test("job research and refresh require authentication", async ({ request }) => {
  expect((await request.get("/api/jobs")).status()).toBe(401);
  expect((await request.post("/api/jobs/refresh")).status()).toBe(401);
  expect((await request.post("/api/job-description-url", { data: { url: "https://jobs.example.com/role" } })).status()).toBe(401);
});

test("writing-service checkout and job automation are protected", async ({ request }) => {
  expect((await request.post("/api/payments/addon-order", { data: { addonId: "resume-writer", currency: "INR" } })).status()).toBe(401);
  expect((await request.post("/api/internal/jobs/daily")).status()).toBe(401);
  expect((await request.post("/api/payments/razorpay-webhook", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/admin/webhooks/example-event/replay", { data: { reason: "Synthetic unauthorized replay attempt." } })).status()).toBe(403);
});

test("billing recovery console denies anonymous users", async ({ page }) => {
  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/dashboard$|\/login\?returnTo=/);
});

for (const path of ["/", "/login", "/signup", "/pricing", "/dashboard", "/review", "/documents", "/profile", "/goals", "/linkedin", "/salary", "/learning", "/opportunities", "/messages", "/billing", "/settings", "/admin", "/admin/payments"]) {
  test(`${path} has no automatically detectable WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}
