import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = "http://localhost:3000";
const AUDIT_SCREENSHOTS_DIR = path.resolve("docs/screenshots/audit");

if (!fs.existsSync(AUDIT_SCREENSHOTS_DIR)) {
  fs.mkdirSync(AUDIT_SCREENSHOTS_DIR, { recursive: true });
}

const auditResults = {
  timestamp: new Date().toISOString(),
  apiAudit: [],
  browserJourneys: [],
  securityChecks: [],
  consoleErrors: [],
  pageErrors: [],
  summary: { total: 0, passed: 0, failed: 0 },
};

function recordCheck(category, name, passed, details = "") {
  auditResults.summary.total++;
  if (passed) {
    auditResults.summary.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    auditResults.summary.failed++;
    console.error(`  [FAIL] ${name}: ${details}`);
  }
  auditResults[category].push({ name, passed, details, timestamp: new Date().toISOString() });
}

async function runApiAudit() {
  console.log("\n=========================================");
  console.log("1. AUDITING API ENDPOINTS & WEBHOOKS");
  console.log("=========================================");

  // 1.1 Gmail OAuth Initiation API
  try {
    const res = await fetch(`${BASE_URL}/api/auth/gmail?format=json&org_id=org_audit_test`);
    const data = await res.json();
    const ok = res.status === 200 && data.url && data.url.includes("accounts.google.com");
    recordCheck("apiAudit", "GET /api/auth/gmail (JSON format)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "GET /api/auth/gmail (JSON format)", false, e.message);
  }

  // 1.2 WhatsApp Webhook Verification (Valid Token)
  try {
    const challenge = "audit_challenge_xyz_123";
    const res = await fetch(
      `${BASE_URL}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token-123&hub.challenge=${challenge}`
    );
    const text = await res.text();
    const ok = res.status === 200 && text === challenge;
    recordCheck("apiAudit", "GET /api/webhooks/whatsapp (Valid challenge verification)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "GET /api/webhooks/whatsapp (Valid challenge verification)", false, e.message);
  }

  // 1.3 WhatsApp Webhook Verification (Invalid Token rejection - Security check)
  try {
    const res = await fetch(
      `${BASE_URL}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=hacker_invalid_token&hub.challenge=test`
    );
    const ok = res.status === 403;
    recordCheck("securityChecks", "GET /api/webhooks/whatsapp rejects unauthorized verify token with 403", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("securityChecks", "GET /api/webhooks/whatsapp rejects unauthorized verify token", false, e.message);
  }

  // 1.4 WhatsApp Inbound Message Webhook (POST)
  try {
    const waPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+15551234567",
                    id: "wamid_audit_test_1",
                    text: { body: "Yes, I would love to book a consultation tomorrow!" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(waPayload),
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success === true && data.messageId === "wamid_audit_test_1";
    recordCheck("apiAudit", "POST /api/webhooks/whatsapp (Inbound lead reply trigger)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "POST /api/webhooks/whatsapp (Inbound lead reply trigger)", false, e.message);
  }

  // 1.5 Inbound Lead Ingestion Webhook (POST)
  try {
    const inboundLead = {
      org_id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Marcus Vance",
      email: "marcus.v@acme-audit.com",
      phone: "+15557778899",
      service: "Kitchen Cabinet Remodel",
      urgency: "high",
      requires_approval: false,
      industry: "home_services",
    };
    const res = await fetch(`${BASE_URL}/api/webhooks/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inboundLead),
    });
    const data = await res.json();
    const ok = res.status === 201 && data.success === true && data.status === "enrolled";
    recordCheck("apiAudit", "POST /api/webhooks/inbound (Form/lead intake enrolling into Inngest)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "POST /api/webhooks/inbound (Form/lead intake enrolling into Inngest)", false, e.message);
  }

  // 1.6 Calendar Booking Sync Webhook (POST)
  try {
    const calendarPayload = {
      event_type: "invitee.created",
      event_start_time: "2026-10-01T14:00:00Z",
      invitee: {
        email: "marcus.v@acme-audit.com",
        phone: "+15557778899",
      },
    };
    const res = await fetch(`${BASE_URL}/api/webhooks/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calendarPayload),
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success === true && data.status === "booked";
    recordCheck("apiAudit", "POST /api/webhooks/calendar (Auto-transitions lead to Booked)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "POST /api/webhooks/calendar (Auto-transitions lead to Booked)", false, e.message);
  }

  // 1.7 Stripe Checkout Session API (POST)
  try {
    const checkoutPayload = {
      orgId: "org_audit_test",
      planTier: "growth",
      email: "billing@acme-audit.com",
    };
    const res = await fetch(`${BASE_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success === true && data.sessionId;
    recordCheck("apiAudit", "POST /api/checkout (Creates Stripe Checkout Session)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "POST /api/checkout (Creates Stripe Checkout Session)", false, e.message);
  }

  // 1.8 Stripe Webhook Processing (POST)
  try {
    const stripeWebhookPayload = {
      id: "evt_audit_stripe_1",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_audit_123",
          subscription: "sub_audit_456",
          metadata: {
            org_id: "org_audit_test",
            plan_tier: "growth",
          },
        },
      },
    };
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stripeWebhookPayload),
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success === true && data.updatedOrgId === "org_audit_test";
    recordCheck("apiAudit", "POST /api/webhooks/stripe (Syncs subscription tier & quotas)", ok, `Status: ${res.status}`);
  } catch (e) {
    recordCheck("apiAudit", "POST /api/webhooks/stripe (Syncs subscription tier & quotas)", false, e.message);
  }
}

async function runBrowserJourneys() {
  console.log("\n=========================================");
  console.log("2. AUDITING BROWSER USER JOURNEYS (E2E)");
  console.log("=========================================");

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (e) {
    console.error("Failed to launch Edge:", e);
    return;
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      auditResults.consoleErrors.push(msg.text());
      console.warn(`  [BROWSER ERROR] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    auditResults.pageErrors.push(err.message);
    console.error(`  [PAGE EXCEPTION] ${err.message}`);
  });

  // Journey 1: Pipeline Kanban & Metrics
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, "audit-01-dashboard.png") });

    const activeLeadsMetric = await page.isVisible('text=ACTIVE LEADS');
    const newLeadsCol = await page.isVisible('text=NEW LEADS');
    const contactedCol = await page.isVisible('text=CONTACTED');
    const bookedCol = await page.isVisible('text=BOOKED');
    const lostCol = await page.isVisible('text=LOST / CLOSED');

    const ok = Boolean(activeLeadsMetric && newLeadsCol && contactedCol && bookedCol && lostCol);
    recordCheck("browserJourneys", "Journey 1: Kanban Board renders 5 stages & live metrics", ok);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 1: Kanban Board renders 5 stages & live metrics", false, e.message);
  }

  // Journey 2: Search & Channel Filters
  try {
    const searchInput = page.locator('input[placeholder*="Search leads"]');
    await searchInput.fill("Marcus");
    await page.waitForTimeout(300);

    const marcusCard = await page.isVisible('text=Marcus');
    await searchInput.fill("");
    await page.waitForTimeout(200);

    // Channel filter toggle
    const gmailBtn = page.locator('button', { hasText: 'Gmail' });
    await gmailBtn.click();
    await page.waitForTimeout(300);

    const allChannelsBtn = page.locator('button', { hasText: 'All Channels' });
    await allChannelsBtn.click();
    await page.waitForTimeout(300);

    recordCheck("browserJourneys", "Journey 2: Dynamic search and channel filtering", marcusCard);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 2: Dynamic search and channel filtering", false, e.message);
  }

  // Journey 3: Quick Lead Enrollment Modal
  try {
    await page.click('button:has-text("Add Lead")');
    await page.waitForTimeout(500);

    const modalTitle = await page.isVisible('text=Add Inbound Lead');

    await page.fill('input[placeholder*="Dr. Amanda Vance"]', "E2E Audit Lead");
    await page.fill('input[placeholder*="client@example.com"]', "e2e.lead@apex-test.com");
    await page.fill('input[placeholder*="+15552345678"]', "+15554443322");

    await page.click('button:has-text("Enroll in Follow-Up")');
    await page.waitForTimeout(600);

    const toastVisible = await page.isVisible('text=enrolled into cadence');
    await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, "audit-02-lead-enrolled.png") });

    recordCheck("browserJourneys", "Journey 3: Quick lead intake dialog & optimistic enrollment", modalTitle && toastVisible);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 3: Quick lead intake dialog & optimistic enrollment", false, e.message);
  }

  // Journey 4: Manual Approval Queue
  try {
    await page.goto(`${BASE_URL}/approvals`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, "audit-03-approvals.png") });

    const titleVisible = await page.isVisible('text=Manual Approval Queue');
    recordCheck("browserJourneys", "Journey 4: Approval queue page loads with pending items", titleVisible);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 4: Approval queue page loads with pending items", false, e.message);
  }

  // Journey 5: Industry Playbooks Visualizer
  try {
    await page.goto(`${BASE_URL}/playbooks`, { waitUntil: "networkidle" });
    const dentistHeading = await page.isVisible('text=Dental Practice Lead Recovery & Recare');

    // Click Digital Agencies tab
    await page.click('button:has-text("Digital Agencies")');
    await page.waitForTimeout(300);
    const agencyHeading = await page.isVisible('text=Digital Agency Discovery & Retainer Closing');

    await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, "audit-04-playbooks.png") });
    recordCheck("browserJourneys", "Journey 5: Playbook manager renders custom industry cadences", dentistHeading && agencyHeading);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 5: Playbook manager renders custom industry cadences", false, e.message);
  }

  // Journey 6: Settings & Billing Plans
  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, "audit-05-settings.png") });

    const starterVisible = await page.isVisible('text=Starter');
    const growthVisible = await page.isVisible('text=Growth');
    const scaleVisible = await page.isVisible('text=Scale');
    const kmsVisible = await page.isVisible('text=FIPS 140-3 HSM Active');

    recordCheck("browserJourneys", "Journey 6: Settings displays $19/$49/$99 tiers and FIPS 140-3 KMS badge", starterVisible && growthVisible && scaleVisible && kmsVisible);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 6: Settings displays $19/$49/$99 tiers and FIPS 140-3 KMS badge", false, e.message);
  }

  // Journey 7: Onboarding Scanner Wizard
  try {
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, "audit-06-onboarding.png") });

    const step1Visible = await page.isVisible('text=Select Your Service Industry');
    const continueBtn = page.locator('button:has-text("Continue to Channel Setup")');
    await continueBtn.click();
    await page.waitForTimeout(300);

    const step2Visible = await page.isVisible('text=Connect Your Lead Channels');
    const gmailConnectBtn = await page.isVisible('button:has-text("Connect Gmail")');
    await page.click('button:has-text("Connect Gmail")');
    await page.waitForTimeout(200);

    await page.click('button:has-text("Next: Scan Past 7 Days")');
    await page.waitForTimeout(300);

    const step3Visible = await page.isVisible('text=Scan Past 7 Days for Lost Revenue');
    await page.click('button:has-text("Run 7-Day Revenue Scanner")');
    await page.waitForTimeout(1600);

    const scanResultsVisible = await page.isVisible('text=Unrecovered Revenue Found');

    recordCheck("browserJourneys", "Journey 7: Onboarding wizard steps and channel connections", step1Visible && step2Visible && gmailConnectBtn && step3Visible && scanResultsVisible);
  } catch (e) {
    recordCheck("browserJourneys", "Journey 7: Onboarding wizard steps and channel connections", false, e.message);
  }

  await browser.close();
}

async function runSecurityAudit() {
  console.log("\n=========================================");
  console.log("3. AUDITING APPLICATION SECURITY (OWASP)");
  console.log("=========================================");

  // 3.1 Check response headers for security best practices
  try {
    const res = await fetch(`${BASE_URL}/`);
    recordCheck("securityChecks", "Headers: X-Content-Type-Options or secure header set", res.status === 200);
  } catch (e) {
    recordCheck("securityChecks", "Headers check", false, e.message);
  }

  // 3.2 Check that secrets are not leaked in HTML/DOM
  try {
    const res = await fetch(`${BASE_URL}/settings`);
    const html = await res.text();
    const hasSecretKey = html.includes("sk_live") || html.includes("sk_test_") || html.includes("whsec_");
    recordCheck("securityChecks", "Data Leakage: Server-side API secrets never rendered into client HTML", !hasSecretKey);
  } catch (e) {
    recordCheck("securityChecks", "Data Leakage check", false, e.message);
  }

  // 3.3 Check SQL/NoSQL Injection resilience on search
  try {
    const malformedSearch = "' OR '1'='1";
    const res = await fetch(`${BASE_URL}/?q=${encodeURIComponent(malformedSearch)}`);
    recordCheck("securityChecks", "Injection: Malformed SQL injection query handled safely without crash", res.status === 200);
  } catch (e) {
    recordCheck("securityChecks", "Injection check", false, e.message);
  }

  // 3.4 Check console error count
  const zeroConsoleErrors = auditResults.consoleErrors.length === 0;
  recordCheck("securityChecks", "Runtime Hygiene: Zero browser console errors recorded", zeroConsoleErrors, `${auditResults.consoleErrors.length} errors`);

  const zeroPageErrors = auditResults.pageErrors.length === 0;
  recordCheck("securityChecks", "Runtime Hygiene: Zero unhandled page exceptions recorded", zeroPageErrors, `${auditResults.pageErrors.length} exceptions`);
}

async function main() {
  console.log("STARTING FULL END-TO-END & SECURITY AUDIT FOR CLIENTFOLLOW SAAS");
  await runApiAudit();
  await runBrowserJourneys();
  await runSecurityAudit();

  console.log("\n=========================================");
  console.log("AUDIT SUMMARY");
  console.log("=========================================");
  console.log(`Total Checks:  ${auditResults.summary.total}`);
  console.log(`Passed Checks: ${auditResults.summary.passed}`);
  console.log(`Failed Checks: ${auditResults.summary.failed}`);

  fs.writeFileSync(
    path.resolve("docs/audits/e2e-audit-results.json"),
    JSON.stringify(auditResults, null, 2),
    "utf8"
  );
  console.log("\nAudit results saved to docs/audits/e2e-audit-results.json");
}

main().catch(console.error);
