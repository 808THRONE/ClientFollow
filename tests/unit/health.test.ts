import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Health Check API (/api/health)", () => {
  it("returns healthy status with system telemetry in mock/development mode", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.uptimeSeconds).toBe("number");
    expect(data.services).toBeDefined();
    expect(data.services.database).toBeDefined();
    expect(data.services.encryption).toBeDefined();
  });
});
