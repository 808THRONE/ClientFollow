export interface TierLimitConfig {
  monthlyPrice: number;
  activeLeadsLimit: number;
  maxChannels: number;
}

export const TIER_CONFIGS: Record<string, TierLimitConfig> = {
  starter: {
    monthlyPrice: 19,
    activeLeadsLimit: 30,
    maxChannels: 1,
  },
  growth: {
    monthlyPrice: 49,
    activeLeadsLimit: 100,
    maxChannels: 2,
  },
  pro: {
    monthlyPrice: 99,
    activeLeadsLimit: 300,
    maxChannels: 5,
  },
};

export interface CapacityEvaluation {
  canEnroll: boolean;
  limit: number;
  current: number;
  remaining: number;
  status: "standard" | "warning" | "queued_over_quota";
  warning80Percent: boolean;
  suggestedTierUpgrade?: string;
}

export class UsageService {
  /**
   * Evaluates organization lead volume capacity against the soft-cap rules.
   */
  static evaluateLeadCapacity(params: {
    tier: string;
    currentActiveLeads: number;
  }): CapacityEvaluation {
    const tier = params.tier.toLowerCase();
    const config = TIER_CONFIGS[tier] || TIER_CONFIGS.starter;
    const limit = config.activeLeadsLimit;
    const current = params.currentActiveLeads;
    const remaining = Math.max(0, limit - current);

    // 1. Soft-Cap Limit Exceeded (>= 100%)
    if (current >= limit) {
      const upgradeTier = tier === "starter" ? "growth" : tier === "growth" ? "pro" : undefined;
      return {
        canEnroll: false,
        limit,
        current,
        remaining: 0,
        status: "queued_over_quota",
        warning80Percent: true,
        suggestedTierUpgrade: upgradeTier,
      };
    }

    // 2. 80% Capacity Warning Threshold
    const isAt80Percent = current / limit >= 0.8;
    if (isAt80Percent) {
      return {
        canEnroll: true,
        limit,
        current,
        remaining,
        status: "warning",
        warning80Percent: true,
      };
    }

    // 3. Standard Capacity
    return {
      canEnroll: true,
      limit,
      current,
      remaining,
      status: "standard",
      warning80Percent: false,
    };
  }
}

/**
 * Computes usage percentage integer rounded to nearest whole number, capped at 100
 */
export function calculateUsagePercentage(current: number, limit: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

