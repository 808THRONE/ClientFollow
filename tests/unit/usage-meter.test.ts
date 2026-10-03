import { describe, it, expect } from "vitest";
import { UsageService, TierLimitConfig } from "@/lib/services/usage.service";

describe("UsageService (Monthly Active Leads & Soft-Cap Metering)", () => {
  const TIER_LIMITS: Record<string, TierLimitConfig> = {
    starter: { monthlyPrice: 19, activeLeadsLimit: 30, maxChannels: 1 },
    growth: { monthlyPrice: 49, activeLeadsLimit: 100, maxChannels: 2 },
    pro: { monthlyPrice: 99, activeLeadsLimit: 300, maxChannels: 5 },
  };

  it("permits lead enrollment under capacity", () => {
    const status = UsageService.evaluateLeadCapacity({
      tier: "starter",
      currentActiveLeads: 10,
    });

    expect(status.canEnroll).toBe(true);
    expect(status.status).toBe("standard");
    expect(status.remaining).toBe(20);
    expect(status.warning80Percent).toBe(false);
  });

  it("flags 80% capacity warning banner", () => {
    const status = UsageService.evaluateLeadCapacity({
      tier: "starter",
      currentActiveLeads: 25, // 25 / 30 = 83.3%
    });

    expect(status.canEnroll).toBe(true);
    expect(status.warning80Percent).toBe(true);
    expect(status.status).toBe("warning");
  });

  it("queues lead when at or exceeding 100% capacity (Soft-Cap)", () => {
    const status = UsageService.evaluateLeadCapacity({
      tier: "starter",
      currentActiveLeads: 30, // 30 / 30 = 100%
    });

    expect(status.canEnroll).toBe(false);
    expect(status.status).toBe("queued_over_quota");
    expect(status.suggestedTierUpgrade).toBe("growth");
  });

  it("calculates correct limits for Pro tier ($99/mo)", () => {
    const status = UsageService.evaluateLeadCapacity({
      tier: "pro",
      currentActiveLeads: 295,
    });

    expect(status.canEnroll).toBe(true);
    expect(status.remaining).toBe(5);
  });
});
