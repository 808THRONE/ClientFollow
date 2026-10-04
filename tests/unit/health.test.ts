import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";

describe("Health Check API (/api/health)", () => {
  it("returns healthy status with system telemetry in readiness mode", async () => {
    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.mode).toBe("readiness");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.uptimeSeconds).toBe("number");
    expect(data.services).toBeDefined();
    expect(data.services.database).toBeDefined();
    expect(data.services.encryption).toBeDefined();
  });

  it("handles fast liveness probe returning 200 immediately", async () => {
    const req = new NextRequest("http://localhost/api/health?type=liveness");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.mode).toBe("liveness");
    expect(typeof data.uptimeSeconds).toBe("number");
  });
});
