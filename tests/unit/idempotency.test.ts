import { describe, it, expect, beforeEach } from "vitest";
import { idempotencyService } from "@/lib/services/idempotency.service";

describe("Idempotency Service & Webhook Deduplication (S12)", () => {
  beforeEach(() => {
    idempotencyService.clear();
  });

  it("identifies new events as unhandled and remembers processed events", async () => {
    const eventId = "evt_stripe_test_1001";
    expect(await idempotencyService.isEventProcessed(eventId)).toBe(false);

    await idempotencyService.markEventProcessed(eventId, { type: "customer.subscription.updated" });
    expect(await idempotencyService.isEventProcessed(eventId)).toBe(true);
  });

  it("handles null, undefined or empty event IDs safely", async () => {
    expect(await idempotencyService.isEventProcessed("")).toBe(false);
    expect(await idempotencyService.isEventProcessed(null as any)).toBe(false);
    expect(await idempotencyService.isEventProcessed(undefined as any)).toBe(false);

    await idempotencyService.markEventProcessed("");
    expect(await idempotencyService.isEventProcessed("")).toBe(false);
  });

  it("deduplicates distinct events independently", async () => {
    await idempotencyService.markEventProcessed("evt_1");
    expect(await idempotencyService.isEventProcessed("evt_1")).toBe(true);
    expect(await idempotencyService.isEventProcessed("evt_2")).toBe(false);
  });
});
