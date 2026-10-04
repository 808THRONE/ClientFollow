import { NextRequest, NextResponse } from "next/server";
import { processGmailPushWebhook } from "@/lib/services/gmail.service";
import { inngest } from "@/inngest/client";

/**
 * Google Cloud Pub/Sub Push Notification Webhook for Gmail Inbox Changes
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const processed = processGmailPushWebhook(body);
    if (!processed) {
      return NextResponse.json(
        { error: "Invalid Pub/Sub payload or missing message data" },
        { status: 400 }
      );
    }

    // Dispatch durable Inngest event to fetch and analyze history diff
    try {
      await inngest.send(processed.inngestEvent);
    } catch (inngestErr: unknown) {
      const msg = inngestErr instanceof Error ? inngestErr.message : String(inngestErr);
      console.warn(`[Gmail Webhook] Inngest dispatch note: ${msg}`);
    }

    return NextResponse.json({
      success: true,
      processed: true,
      emailAddress: processed.emailAddress,
      historyId: processed.historyId,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
