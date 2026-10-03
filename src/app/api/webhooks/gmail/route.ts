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
    } catch (inngestErr: any) {
      console.warn(`[Gmail Webhook] Inngest dispatch note: ${inngestErr?.message || inngestErr}`);
    }

    return NextResponse.json({
      success: true,
      processed: true,
      emailAddress: processed.emailAddress,
      historyId: processed.historyId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
