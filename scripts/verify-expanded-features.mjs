import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots", "features");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verifyExpandedFeatures() {
  console.log("STARTING EXPANDED FEATURES VERIFICATION...\n");

  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  const results = [];
  function record(name, passed, details = "") {
    results.push({ name, passed, details });
    console.log(`  [${passed ? "PASS" : "FAIL"}] ${name} ${details ? "(" + details + ")" : ""}`);
  }

  // 1. Verify /login
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    const hasHeading = await page.isVisible('text=Sign in to ClientFollow');
    const hasDemoFill = await page.isVisible('text=Quick Fill Demo Operator Account');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-login-page.png") });
    record("Feature 1: Login Page loads with demo autofill", hasHeading && hasDemoFill);
  } catch (e) {
    record("Feature 1: Login Page loads with demo autofill", false, e.message);
  }

  // 2. Verify /signup
  try {
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
    const hasSignupHeading = await page.isVisible('text=Create your ClientFollow account');
    const hasIndustrySelect = await page.isVisible('select');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-signup-page.png") });
    record("Feature 2: Signup Page loads with industry selector", hasSignupHeading && hasIndustrySelect);
  } catch (e) {
    record("Feature 2: Signup Page loads with industry selector", false, e.message);
  }

  // 3. Verify Lead Drawer & Timeline on Dashboard (/)
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    // Click first lead card
    const firstCard = page.locator('div[draggable="true"]').first();
    await firstCard.click();
    await page.waitForTimeout(400);

    const hasTimeline = await page.isVisible('text=Cadence Activity Timeline');
    const hasNotes = await page.isVisible('text=Internal Notes');
    const hasResend = await page.isVisible('button:has-text("Resend Follow-Up Touch")');

    // Add note
    await page.fill('input[placeholder*="Add private operator note"]', "Verified client budget is approved for $5k treatment.");
    await page.click('button:has-text("Save Note")');
    await page.waitForTimeout(200);

    // Resend follow-up
    await page.click('button:has-text("Resend Follow-Up Touch")');
    await page.waitForTimeout(300);
    const hasResendSuccess = await page.isVisible('text=Follow-up dispatched to queue');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-lead-drawer-enhanced.png") });
    record("Feature 3: Enhanced Lead Drawer with timeline, operator notes & resend touch", hasTimeline && hasNotes && hasResend && hasResendSuccess);

    // Close drawer
    await page.click('button[aria-label="Close drawer"]');
  } catch (e) {
    record("Feature 3: Enhanced Lead Drawer with timeline, operator notes & resend touch", false, e.message);
  }

  // 4. Verify Interactive Playbook Editor (/playbooks)
  try {
    await page.goto(`${BASE_URL}/playbooks`, { waitUntil: "networkidle" });
    // Add touch
    await page.click('button:has-text("Add Touch")');
    await page.waitForTimeout(300);

    // Edit directives on step 1
    const editBtn = page.locator('button:has-text("Edit Directives")').first();
    await editBtn.click();
    await page.waitForTimeout(200);

    // Click Save Cadence
    await page.click('button:has-text("Save Cadence")');
    await page.waitForTimeout(500);

    const saveToast = await page.isVisible('text=Successfully saved');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-playbook-editor.png") });
    record("Feature 4: Interactive Playbook Editor (add touch, edit directives, save cadence)", saveToast);
  } catch (e) {
    record("Feature 4: Interactive Playbook Editor (add touch, edit directives, save cadence)", false, e.message);
  }

  // 5. Verify Settings Hub Tabs & Webhook Simulator (/settings)
  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    // Click Webhook Simulator Tab
    await page.click('button:has-text("Webhook Simulator & API")');
    await page.waitForTimeout(300);

    const simTitle = await page.isVisible('text=Inbound Webhook Simulator');
    await page.click('button:has-text("Simulate Inbound Webhook Call")');
    await page.waitForSelector('text=HTTP 201 Created', { timeout: 10000 });
    const simResult = await page.isVisible('text=HTTP 201 Created');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-webhook-simulator.png") });

    // Click Mobile & Channel Alerts Tab
    await page.click('button:has-text("Mobile & Channel Alerts")');
    await page.waitForTimeout(300);
    const alertsTitle = await page.isVisible('text=Mobile & Channel Alerts');

    record("Feature 5: Settings Hub with multi-tab nav & live Webhook Simulator", simTitle && simResult && alertsTitle);
  } catch (e) {
    record("Feature 5: Settings Hub with multi-tab nav & live Webhook Simulator", false, e.message);
  }

  // 6. Verify Dedicated Gmail Callback (/api/auth/gmail/callback)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/gmail/callback?code=mock_oauth_code&state=org_demo`, {
      redirect: "manual",
    });
    const location = res.headers.get("Location") || "";
    const ok = res.status === 307 && location.includes("/settings?connected=gmail");
    record("Feature 6: Dedicated Gmail OAuth Callback route (/api/auth/gmail/callback)", ok);
  } catch (e) {
    record("Feature 6: Dedicated Gmail OAuth Callback route (/api/auth/gmail/callback)", false, e.message);
  }

  await browser.close();

  const allPassed = results.every((r) => r.passed);
  console.log("\n=========================================");
  console.log(`EXPANDED FEATURES AUDIT: ${allPassed ? "100% PASSED" : "FAILED"}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length} / ${results.length}`);
  console.log("=========================================\n");

  fs.writeFileSync(
    path.join(process.cwd(), "docs", "audits", "expanded-features-audit.json"),
    JSON.stringify(results, null, 2)
  );

  if (!allPassed) {
    process.exit(1);
  }
}

verifyExpandedFeatures().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
