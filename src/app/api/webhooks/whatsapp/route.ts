import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { createServerSupabaseClient } from "@/lib/db/client";
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
 * Meta WhatsApp Message Ingestion (POST) with HMAC signature verification and sender matching
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
      const fromPhone = String(message.from || "").trim();
      const textBody = message.text?.body || "";
      const messageId = message.id;

      let matchedLeadId: string | null = null;
      let matchedOrgId: string | null = null;

      // Verify sender against known active leads in database
      if (env.isSupabaseLive && fromPhone) {
        try {
          const supabase = createServerSupabaseClient();
          const cleanPhone = fromPhone.replace(/^\+/, "");
          const { data: matchedLead, error: lookupErr } = await supabase
            .from("leads")
            .select("id, org_id, status")
            .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
            .not("status", "in", '("booked","lost")')
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lookupErr) {
            logger.warn("WhatsApp lead lookup database query warning", {
              service: "WhatsAppWebhook",
              fromPhone,
              error: lookupErr.message,
            });
          } else if (matchedLead) {
            matchedLeadId = matchedLead.id;
            matchedOrgId = matchedLead.org_id;

            // Advance lead status to 'replied' in DB
            await supabase
              .from("leads")
              .update({ status: "replied", updated_at: new Date().toISOString() })
              .eq("id", matchedLead.id);
          }
        } catch (dbErr: any) {
          logger.warn("Database lookup error during WhatsApp sender verification", {
            service: "WhatsAppWebhook",
            fromPhone,
            error: dbErr.message,
          });
        }
      } else {
        // Mock / development fallback
        matchedLeadId = `lead_whatsapp_${fromPhone}`;
      }

      if (matchedLeadId) {
        // Emit reply event to immediately halt pending cadence
        try {
          await inngest.send({
            name: "app/lead.replied",
            data: {
              lead_id: matchedLeadId,
              org_id: matchedOrgId || undefined,
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

        return NextResponse.json({ success: true, messageId, leadId: matchedLeadId });
      }

      logger.info("WhatsApp message received from unknown sender; no active lead cadence matched", {
        service: "WhatsAppWebhook",
        fromPhone,
      });

      return NextResponse.json({
        success: true,
        messageId,
        matched: false,
        note: "Message acknowledged; sender not matched to an active cadence",
      });
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
