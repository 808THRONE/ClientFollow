import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("In-Memory Rate Limiter", () => {
  const TEST_IP = "192.168.1.50";
  const OPTIONS = {
    windowMs: 1000, // 1 second
    max: 3,
  };

  beforeEach(() => {
    resetRateLimit(TEST_IP);
  });

  it("allows requests within maximum limit", () => {
    const res1 = checkRateLimit(TEST_IP, OPTIONS);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = checkRateLimit(TEST_IP, OPTIONS);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit(TEST_IP, OPTIONS);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests once maximum limit is exceeded", () => {
    checkRateLimit(TEST_IP, OPTIONS);
    checkRateLimit(TEST_IP, OPTIONS);
    checkRateLimit(TEST_IP, OPTIONS);

    const blocked = checkRateLimit(TEST_IP, OPTIONS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetInSeconds).toBeGreaterThan(0);
  });

  it("allows new requests after reset", () => {
    checkRateLimit(TEST_IP, OPTIONS);
    checkRateLimit(TEST_IP, OPTIONS);
    checkRateLimit(TEST_IP, OPTIONS);

    resetRateLimit(TEST_IP);

    const res = checkRateLimit(TEST_IP, OPTIONS);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
  });
});
