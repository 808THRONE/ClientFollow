import { describe, it, expect } from "vitest";
import {
  formatInstantReplyAlert,
  formatMorningDigestEmail,
} from "@/inngest/functions/mobile-alerts";

describe("Mobile Alert Dispatcher (WhatsApp / SMS / Slack Notifications)", () => {
  it("formats urgent lead reply notification with 1-click takeover link", () => {
    const alert = formatInstantReplyAlert({
      leadName: "Sarah Miller",
      service: "Teeth Whitening",
      replySnippet: "Can we do Thursday at 2 PM?",
      leadId: "lead_789",
      baseUrl: "https://app.clientfollow.com",
    });

    expect(alert).toContain("Sarah Miller");
    expect(alert).toContain("Teeth Whitening");
    expect(alert).toContain("Can we do Thursday at 2 PM?");
    expect(alert).toContain("https://app.clientfollow.com/leads/lead_789");
  });

  it("formats daily 8:00 AM morning digest email", () => {
    const digest = formatMorningDigestEmail({
      orgName: "Apex Dental Studio",
      touchesScheduledToday: 5,
      leadsPendingApproval: 2,
      bookingsYesterday: 3,
      conversionRate30d: 38.5,
    });

    expect(digest).toContain("Apex Dental Studio");
    expect(digest).toContain("Touches scheduled today: 5");
    expect(digest).toContain("Awaiting your approval: 2");
    expect(digest).toContain("New bookings yesterday: 3");
    expect(digest).toContain("38.5%");
  });
});
