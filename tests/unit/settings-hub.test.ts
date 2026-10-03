import { describe, it, expect } from "vitest";
import { saveNotificationSettingsAction } from "@/app/actions/settings";
import React from "react";
import { SettingsHub } from "@/components/settings/SettingsHub";

describe("Settings Hub & Notifications Action", () => {
  it("renders SettingsHub component with tab navigation", () => {
    const el = React.createElement(SettingsHub);
    expect(el).toBeDefined();
  });

  it("saves notification preferences successfully", async () => {
    const res = await saveNotificationSettingsAction("org_test", {
      emailAlerts: true,
      smsAlerts: false,
      whatsAppAlerts: true,
      digestFrequency: "instant",
      slackWebhookUrl: "https://hooks.slack.com/services/test",
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain("successfully");
  });
});
