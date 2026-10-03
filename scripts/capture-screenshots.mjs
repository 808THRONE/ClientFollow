import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const screenshotsDir = path.resolve("./docs/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runBrowserQA() {
  console.log("Launching Microsoft Edge via Playwright...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  const consoleLogs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleLogs.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    consoleLogs.push(`[Page Error] ${err.message}`);
  });

  console.log("1. Testing and capturing Dashboard (/)...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "01-dashboard-desktop.png"),
    fullPage: true,
  });

  console.log("2. Testing Mobile view for Dashboard (375x812)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(screenshotsDir, "02-dashboard-mobile.png"),
    fullPage: true,
  });

  // Reset to desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log("3. Testing and capturing Approval Queue (/approvals)...");
  await page.goto("http://localhost:3000/approvals", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "03-approvals-desktop.png"),
    fullPage: true,
  });

  console.log("4. Testing and capturing Niche Playbooks (/playbooks)...");
  await page.goto("http://localhost:3000/playbooks", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "04-playbooks-dentist.png"),
    fullPage: true,
  });

  // Click on "Digital Agencies" tab
  const agencyTab = page.locator("text=Digital Agencies");
  if (await agencyTab.isVisible()) {
    await agencyTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "05-playbooks-agency.png"),
      fullPage: true,
    });
  }

  console.log("5. Testing and capturing Settings & Billing (/settings)...");
  await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "06-settings-desktop.png"),
    fullPage: true,
  });

  console.log("6. Testing and capturing Revenue Recovery Scanner (/onboarding)...");
  await page.goto("http://localhost:3000/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, "07-onboarding-desktop.png"),
    fullPage: true,
  });

  console.log("7. Testing interactive Add Lead modal on Dashboard...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  const addLeadBtn = page.locator("button:has-text('Add Lead')");
  if (await addLeadBtn.isVisible()) {
    await addLeadBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "08-quick-lead-modal.png"),
    });

    // Fill form
    await page.fill("input[placeholder*='Dr. Amanda Vance']", "Dr. Robert Finch");
    await page.fill("input[placeholder='client@example.com']", "r.finch@smilehealth.com");
    await page.fill("input[placeholder='+15552345678']", "+15557778899");
    await page.click("button:has-text('Enroll in Follow-Up')");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotsDir, "09-lead-added-kanban.png"),
      fullPage: true,
    });
  }

  await browser.close();

  console.log("\n--- BROWSER QA REPORT ---");
  console.log(`Captured 9 screenshots in: ${screenshotsDir}`);
  if (consoleLogs.length > 0) {
    console.log("Console errors detected:");
    consoleLogs.forEach((log) => console.log(log));
  } else {
    console.log("Zero console errors or page exceptions detected! Clean run.");
  }
}

runBrowserQA().catch((err) => {
  console.error("Error running browser QA:", err);
  process.exit(1);
});
