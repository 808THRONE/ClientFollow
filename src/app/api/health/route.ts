import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/db/client";

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  mode: "liveness" | "readiness";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: "connected" | "mock_mode" | "error";
    encryption: "active" | "mock_mode";
    workflows: "configured" | "unconfigured";
  };
  details?: Record<string, string>;
}

const startTime = Date.now();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("type") || searchParams.get("mode") || "readiness") as "liveness" | "readiness";

  // Fast liveness probe for orchestrators / process supervisors
  if (mode === "liveness") {
    return NextResponse.json({
      status: "healthy",
      mode: "liveness",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    });
  }

  const response: HealthCheckResponse = {
    status: "healthy",
    mode: "readiness",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: env.NODE_ENV,
    services: {
      database: env.isSupabaseLive ? "connected" : "mock_mode",
      encryption: env.isKmsLive ? "active" : "mock_mode",
      workflows: env.INNGEST_EVENT_KEY ? "configured" : "unconfigured",
    },
  };

  // Perform active database ping if configured for readiness
  if (env.isSupabaseLive) {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.from("leads").select("id").limit(1);
      if (error) {
        response.status = "unhealthy";
        response.services.database = "error";
        response.details = { database: error.message };
      }
    } catch (err: unknown) {
      response.status = "unhealthy";
      response.services.database = "error";
      response.details = {
        database: err instanceof Error ? err.message : "Database connection failed",
      };
    }
  }

  const statusCode = response.status === "unhealthy" ? 503 : 200;
  return NextResponse.json(response, { status: statusCode });
}
