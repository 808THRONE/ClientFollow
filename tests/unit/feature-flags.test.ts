import { describe, it, expect, beforeEach } from "vitest";
import {
  isFeatureEnabled,
  setFeatureFlagOverride,
  resetFeatureFlagOverrides,
  getAllFeatureFlags,
} from "@/lib/feature-flags";

describe("Feature Flags System", () => {
  beforeEach(() => {
    resetFeatureFlagOverrides();
    delete process.env.FEATURE_FLAG_WHATSAPP_INTEGRATION;
  });

  it("should return default value when no overrides exist", () => {
    expect(isFeatureEnabled("automated_cadence_execution")).toBe(true);
    expect(isFeatureEnabled("slack_notifications")).toBe(false);
  });

  it("should respect runtime overrides", () => {
    setFeatureFlagOverride("automated_cadence_execution", false);
    expect(isFeatureEnabled("automated_cadence_execution")).toBe(false);
  });

  it("should respect org-specific overrides", () => {
    setFeatureFlagOverride("slack_notifications", true, "org_vip_client");
    expect(isFeatureEnabled("slack_notifications", { orgId: "org_vip_client" })).toBe(true);
    expect(isFeatureEnabled("slack_notifications", { orgId: "org_standard" })).toBe(false);
  });

  it("should respect environment variable overrides", () => {
    process.env.FEATURE_FLAG_WHATSAPP_INTEGRATION = "false";
    expect(isFeatureEnabled("whatsapp_integration")).toBe(false);

    process.env.FEATURE_FLAG_WHATSAPP_INTEGRATION = "true";
    expect(isFeatureEnabled("whatsapp_integration")).toBe(true);
  });

  it("should return a complete snapshot of all feature flags", () => {
    const flags = getAllFeatureFlags();
    expect(flags).toHaveProperty("automated_cadence_execution");
    expect(flags).toHaveProperty("circuit_breaker_enabled");
    expect(flags).toHaveProperty("ai_intent_classifier");
  });
});
