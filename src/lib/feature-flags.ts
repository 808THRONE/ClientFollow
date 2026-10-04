/**
 * Feature Flags & Gradual Rollout Management System
 *
 * Provides centralized toggle controls for gradual rollout of external integrations,
 * AI classification models, and autonomous cadence features.
 */

export type FeatureFlagKey =
  | "automated_cadence_execution"
  | "whatsapp_integration"
  | "ai_intent_classifier"
  | "circuit_breaker_enabled"
  | "strict_rate_limiting"
  | "slack_notifications"
  | "gdpr_data_retention_purge";

export interface FeatureFlagContext {
  orgId?: string;
  userRole?: string;
}

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  automated_cadence_execution: true,
  whatsapp_integration: true,
  ai_intent_classifier: true,
  circuit_breaker_enabled: true,
  strict_rate_limiting: true,
  slack_notifications: false,
  gdpr_data_retention_purge: true,
};

// In-memory runtime override map (useful for tests and dynamic admin toggles)
const runtimeOverrides = new Map<string, boolean>();

/**
 * Checks whether an environment variable overrides a given feature flag.
 * E.g., FEATURE_FLAG_WHATSAPP_INTEGRATION=false
 */
function getEnvOverride(key: FeatureFlagKey): boolean | undefined {
  const envVarName = `FEATURE_FLAG_${key.toUpperCase()}`;
  const envVal = process.env[envVarName]?.trim().toLowerCase();

  if (envVal === "true" || envVal === "1") return true;
  if (envVal === "false" || envVal === "0") return false;
  return undefined;
}

/**
 * Determines whether a specific feature flag is currently active.
 */
export function isFeatureEnabled(
  flag: FeatureFlagKey,
  context?: FeatureFlagContext
): boolean {
  // 1. Check runtime override (per org if provided)
  if (context?.orgId) {
    const orgOverrideKey = `${context.orgId}:${flag}`;
    if (runtimeOverrides.has(orgOverrideKey)) {
      return runtimeOverrides.get(orgOverrideKey)!;
    }
  }

  // 2. Check global runtime override
  if (runtimeOverrides.has(flag)) {
    return runtimeOverrides.get(flag)!;
  }

  // 3. Check environment variable override
  const envOverride = getEnvOverride(flag);
  if (envOverride !== undefined) {
    return envOverride;
  }

  // 4. Fall back to standard defaults
  return DEFAULT_FLAGS[flag] ?? false;
}

/**
 * Sets a runtime override for testing or emergency circuit breaks.
 */
export function setFeatureFlagOverride(
  flag: FeatureFlagKey,
  enabled: boolean,
  orgId?: string
): void {
  const key = orgId ? `${orgId}:${flag}` : flag;
  runtimeOverrides.set(key, enabled);
}

/**
 * Resets all runtime feature flag overrides.
 */
export function resetFeatureFlagOverrides(): void {
  runtimeOverrides.clear();
}

/**
 * Returns a snapshot of all active feature flags for a context.
 */
export function getAllFeatureFlags(
  context?: FeatureFlagContext
): Record<FeatureFlagKey, boolean> {
  const result = {} as Record<FeatureFlagKey, boolean>;
  for (const flag of Object.keys(DEFAULT_FLAGS) as FeatureFlagKey[]) {
    result[flag] = isFeatureEnabled(flag, context);
  }
  return result;
}
