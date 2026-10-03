import { describe, it, expect } from "vitest";
import { TIER_CONFIGS } from "@/lib/services/usage.service";
import { STRIPE_TIER_PRICES } from "@/lib/services/stripe.service";

describe("Settings & Billing Portal Specs", () => {
  it("matches pricing tiers between usage service and stripe config", () => {
    expect(TIER_CONFIGS.starter.monthlyPrice).toBe(19);
    expect(TIER_CONFIGS.growth.monthlyPrice).toBe(49);
    expect(TIER_CONFIGS.pro.monthlyPrice).toBe(99);

    expect(STRIPE_TIER_PRICES.starter).toBeDefined();
    expect(STRIPE_TIER_PRICES.growth).toBeDefined();
    expect(STRIPE_TIER_PRICES.pro).toBeDefined();
  });

  it("verifies lead volume capacity increases per tier", () => {
    expect(TIER_CONFIGS.starter.activeLeadsLimit).toBe(30);
    expect(TIER_CONFIGS.growth.activeLeadsLimit).toBe(100);
    expect(TIER_CONFIGS.pro.activeLeadsLimit).toBe(300);
  });
});
