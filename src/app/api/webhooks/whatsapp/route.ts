import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * Meta WhatsApp Webhook Verification (GET)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn("WhatsApp webhook GET challenge verification failed", {
    service: "WhatsAppWebhook",
    mode,
  });
  return NextResponse.json({ success: false, error: "Verification failed" }, { status: 403 });
}

/**
 * Meta WhatsApp Message Ingestion (POST) with HMAC signature verification
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const appSecret = env.WHATSAPP_APP_SECRET;
    const signature = req.headers.get("x-hub-signature-256");

    // Enforce HMAC signature check
    if (appSecret) {
      if (!signature) {
        logger.warn("WhatsApp webhook rejected: Missing x-hub-signature-256 header", {
          service: "WhatsAppWebhook",
        });
        return NextResponse.json({ success: false, error: "Missing signature" }, { status: 401 });
      }

      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex")}`;

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        logger.warn("WhatsApp webhook rejected: Invalid HMAC signature", {
          service: "WhatsAppWebhook",
        });
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    } else if (env.isProduction) {
      logger.warn("WhatsApp webhook rejected: WHATSAPP_APP_SECRET required in production", {
        service: "WhatsAppWebhook",
      });
      return NextResponse.json(
        { success: false, error: "Webhook secret not configured" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody || "{}");
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const fromPhone = message.from;
      const textBody = message.text?.body || "";
      const messageId = message.id;

      // Emit reply event to immediately halt any pending follow-up sequence
      try {
        await inngest.send({
          name: "app/lead.replied",
          data: {
            lead_id: `lead_whatsapp_${fromPhone}`,
            channel: "whatsapp",
            reply_snippet: textBody,
            sentiment: "neutral",
          },
        });
      } catch (inngestErr: any) {
        logger.warn("Inngest dispatch warning on WhatsApp message", {
          service: "WhatsAppWebhook",
          error: inngestErr.message,
        });
      }

      return NextResponse.json({ success: true, messageId });
    }

    return NextResponse.json({ success: true, status: "ignored_non_message_event" });
  } catch (error: any) {
    logger.error("Error processing WhatsApp webhook payload", {
      service: "WhatsAppWebhook",
      error: error.message,
    });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
