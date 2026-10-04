import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/db/client";

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
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

export async function GET() {
  const response: HealthCheckResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: env.NODE_ENV,
    services: {
      database: env.isSupabaseLive ? "connected" : "mock_mode",
      encryption: env.isKmsLive ? "active" : "mock_mode",
      workflows: env.INNGEST_EVENT_KEY ? "configured" : "unconfigured",
    },
  };

  // Perform active database ping if configured
  if (env.isSupabaseLive) {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.from("leads").select("id").limit(1);
      if (error) {
        response.status = "degraded";
        response.services.database = "error";
        response.details = { database: error.message };
      }
    } catch (err: unknown) {
      response.status = "degraded";
      response.services.database = "error";
      response.details = {
        database: err instanceof Error ? err.message : "Database connection failed",
      };
    }
  }

  const statusCode = response.status === "unhealthy" ? 503 : 200;
  return NextResponse.json(response, { status: statusCode });
}
