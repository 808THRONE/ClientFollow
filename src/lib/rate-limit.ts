interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

// In-memory store for rate limiting with automatic pruning
const store = new Map<string, RateLimitRecord>();
let lastPruned = Date.now();
const PRUNE_INTERVAL_MS = 60 * 1000; // 1 minute

function pruneExpiredEntries(): void {
  const now = Date.now();
  if (now - lastPruned < PRUNE_INTERVAL_MS) return;
  lastPruned = now;

  for (const [key, record] of store.entries()) {
    if (record.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Checks and increments the rate limit count for a given identifier.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  pruneExpiredEntries();

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return {
      allowed: true,
      remaining: options.max - 1,
      resetInSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  if (existing.count >= options.max) {
    const resetInSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  existing.count += 1;
  const resetInSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed: true,
    remaining: options.max - existing.count,
    resetInSeconds,
  };
}

/**
 * Resets the rate limit for a given identifier (e.g. on successful authentication).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
