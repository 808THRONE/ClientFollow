import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker, CircuitBreakerError } from "@/lib/circuit-breaker";

describe("Circuit Breaker Utility", () => {
  it("executes successful action normally when CLOSED", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, timeoutMs: 1000 });
    const result = await breaker.execute(async () => "success");
    expect(result).toBe("success");
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("trips to OPEN state after hitting failure threshold", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      recoveryTimeoutMs: 1000,
      timeoutMs: 500,
      name: "TestService",
    });

    // Failure 1
    await expect(
      breaker.execute(async () => {
        throw new Error("API network failure");
      })
    ).rejects.toThrow("API network failure");
    expect(breaker.getState()).toBe("CLOSED");

    // Failure 2 (reaches threshold)
    await expect(
      breaker.execute(async () => {
        throw new Error("API network failure");
      })
    ).rejects.toThrow("API network failure");
    expect(breaker.getState()).toBe("OPEN");

    // Next call fast-fails without executing action
    const mockAction = vi.fn();
    await expect(breaker.execute(mockAction)).rejects.toThrow(CircuitBreakerError);
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("uses fallback when available instead of throwing", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const result = await breaker.execute(
      async () => {
        throw new Error("Remote crash");
      },
      () => "cached_fallback"
    );

    expect(result).toBe("cached_fallback");
  });

  it("enforces timeout on slow external operations", async () => {
    const breaker = new CircuitBreaker({ timeoutMs: 50 });
    await expect(
      breaker.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "too late";
      })
    ).rejects.toThrow(/timed out/);
  });
});
