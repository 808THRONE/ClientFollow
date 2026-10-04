import { logger } from "@/lib/logger";

interface IdempotencyRecord {
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * In-memory idempotency store with automatic eviction and bounded size.
 * In a multi-region/distributed cluster, this is backed by Redis or Supabase.
 */
class IdempotencyService {
  private processedEvents = new Map<string, IdempotencyRecord>();
  private maxStoreSize = 10_000;
  private defaultTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Run background cleanup every 15 minutes in long-running processes
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.pruneExpired(), 15 * 60 * 1000);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
    }
  }

  /**
   * Check if an event ID has already been successfully processed.
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    if (!eventId || typeof eventId !== "string") return false;
    const record = this.processedEvents.get(eventId);
    if (!record) return false;

    if (Date.now() - record.timestamp > this.defaultTtlMs) {
      this.processedEvents.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * Record that an event ID has been processed.
   */
  async markEventProcessed(eventId: string, details?: Record<string, unknown>): Promise<void> {
    if (!eventId || typeof eventId !== "string") return;

    // Guard store size to prevent memory exhaustion under spoofed payloads
    if (this.processedEvents.size >= this.maxStoreSize) {
      this.pruneExpired();
      if (this.processedEvents.size >= this.maxStoreSize) {
        // Evict oldest entry
        const oldestKey = this.processedEvents.keys().next().value;
        if (oldestKey) this.processedEvents.delete(oldestKey);
      }
    }

    this.processedEvents.set(eventId, {
      timestamp: Date.now(),
      details,
    });

    logger.debug("Event marked as processed for idempotency", {
      service: "IdempotencyService",
      eventId,
    });
  }

  /**
   * Remove expired entries from memory.
   */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.processedEvents.entries()) {
      if (now - record.timestamp > this.defaultTtlMs) {
        this.processedEvents.delete(key);
      }
    }
  }

  /**
   * Clears all recorded events (primarily for testing).
   */
  clear(): void {
    this.processedEvents.clear();
  }
}

export const idempotencyService = new IdempotencyService();
