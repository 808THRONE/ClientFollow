import { logger } from "@/lib/logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of consecutive failures to trip circuit (default: 3)
  recoveryTimeoutMs?: number; // How long to stay OPEN before testing HALF_OPEN (default: 30s)
  timeoutMs?: number; // Max execution time for the call before timeout rejection (default: 10s)
  name?: string;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly isCircuitOpen: boolean = false) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Resilient Circuit Breaker implementation for external API and network boundaries.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private nextAttemptAt = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly timeoutMs: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 30_000;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.name = options.name ?? "DefaultCircuitBreaker";
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttemptAt) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  /**
   * Executes the given async action through the circuit breaker with timeout and failure tracking.
   */
  public async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      logger.warn(`Circuit [${this.name}] is OPEN — fast-failing request`, {
        service: "CircuitBreaker",
        name: this.name,
      });

      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerError(
        `Service [${this.name}] is temporarily unavailable (circuit OPEN)`,
        true
      );
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new CircuitBreakerError(`Call to [${this.name}] timed out after ${this.timeoutMs}ms`)
              ),
            this.timeoutMs
          )
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err: unknown) {
      this.onFailure(err);

      if (fallback) {
        logger.info(`Circuit [${this.name}] activating fallback after error`, {
          service: "CircuitBreaker",
          error: err instanceof Error ? err.message : String(err),
        });
        return fallback();
      }

      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(err: unknown): void {
    this.failureCount += 1;
    logger.warn(`Circuit [${this.name}] recorded failure #${this.failureCount}`, {
      service: "CircuitBreaker",
      name: this.name,
      failureCount: this.failureCount,
      error: err instanceof Error ? err.message : String(err),
    });

    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttemptAt = Date.now() + this.recoveryTimeoutMs;
      logger.error(`Circuit [${this.name}] has TRIPPED to OPEN state`, {
        service: "CircuitBreaker",
        name: this.name,
        recoveryTimeoutMs: this.recoveryTimeoutMs,
      });
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.nextAttemptAt = 0;
  }
}
