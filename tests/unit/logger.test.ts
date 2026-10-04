import { describe, it, expect, vi } from "vitest";
import { logger, withCorrelationId, getCorrelationId } from "@/lib/logger";

describe("Structured Logger Observability & Correlation Tracing", () => {
  it("maintains correlation ID within async context", () => {
    const correlationId = "corr_req_123456789";

    withCorrelationId(correlationId, () => {
      expect(getCorrelationId()).toBe(correlationId);
      expect(logger.getCorrelationId()).toBe(correlationId);
    });

    expect(getCorrelationId()).toBeUndefined();
  });

  it("logs formatted messages without error", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test message", { service: "TestService", correlationId: "trace_abc" });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
