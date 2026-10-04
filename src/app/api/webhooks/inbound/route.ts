import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LeadSchema } from "@/lib/db/validators";
import { inngest } from "@/inngest/client";
import { getPlaybookForIndustry } from "@/lib/services/playbook.service";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const InboundPayloadSchema = z.object({
  org_id: z.string().min(1, "org_id is required"),
  industry: z.string().max(50).optional(),
  requires_approval: z.boolean().optional(),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  service: z.string().max(100).optional().nullable(),
  urgency: z.enum(["low", "medium", "high"]).optional(),
  lead: z
    .object({
      name: z.string().max(200).optional().nullable(),
      email: z.string().email("Invalid email format").optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
      service: z.string().max(100).optional().nullable(),
      urgency: z.enum(["low", "medium", "high"]).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsedPayload = InboundPayloadSchema.safeParse(rawBody);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload schema", details: parsedPayload.error.format() },
        { status: 400 }
      );
    }

    const { org_id: orgId, industry, requires_approval, lead, ...directFields } = parsedPayload.data;

    // In production, validate UUID format
    if (env.isProduction && !UUID_REGEX.test(orgId)) {
      return NextResponse.json(
        { success: false, error: "Invalid org_id: must be a valid UUID" },
        { status: 400 }
      );
    }

    // Extract only strictly allowed contact fields — preventing any mass assignment
    const contactName = lead?.name ?? directFields.name ?? null;
    const contactEmail = lead?.email ?? directFields.email ?? null;
    const contactPhone = lead?.phone ?? directFields.phone ?? null;
    const detectedService = lead?.service ?? directFields.service ?? "General Inquiry";
    const detectedUrgency = lead?.urgency ?? directFields.urgency ?? "medium";

    const parsedLead = LeadSchema.safeParse({
      org_id: orgId,
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
      source: "webhook",
      status: "new_lead",
      detected_service: detectedService,
      detected_urgency: detectedUrgency,
      sentiment: "neutral",
      requires_approval: requires_approval ?? true,
    });

    if (!parsedLead.success) {
      return NextResponse.json(
        { success: false, error: "Invalid lead payload", details: parsedLead.error.format() },
        { status: 400 }
      );
    }

    const leadId = crypto.randomUUID();
    const playbook = getPlaybookForIndustry(industry || "general");

    if (env.isSupabaseLive) {
      try {
        const supabase = createServerSupabaseClient();
        const { error: insertErr } = await supabase.from("leads").insert({
          id: leadId,
          org_id: parsedLead.data.org_id,
          name: parsedLead.data.name,
          email: parsedLead.data.email,
          phone: parsedLead.data.phone,
          source: parsedLead.data.source,
          status: parsedLead.data.status,
          detected_service: parsedLead.data.detected_service,
          detected_urgency: parsedLead.data.detected_urgency,
          sentiment: parsedLead.data.sentiment,
          requires_approval: parsedLead.data.requires_approval,
          approval_pending: parsedLead.data.requires_approval,
          created_at: new Date().toISOString(),
        });

        if (insertErr) {
          logger.error("Failed to insert inbound lead into database", {
            service: "InboundWebhook",
            orgId,
            error: insertErr.message,
          });
        }
      } catch (dbErr: unknown) {
        logger.error("Database connection error during inbound lead insert", {
          service: "InboundWebhook",
          orgId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }
    }

    // Trigger Inngest durable sequence
    try {
      await inngest.send({
        name: "app/lead.detected",
        data: {
          lead_id: leadId,
          org_id: parsedLead.data.org_id,
          service: parsedLead.data.detected_service,
          requires_approval: parsedLead.data.requires_approval,
          playbook_steps: playbook.steps,
        },
      });
    } catch (inngestErr: unknown) {
      logger.warn("Inngest dispatch warning on inbound lead", {
        service: "InboundWebhook",
        leadId,
        error: inngestErr instanceof Error ? inngestErr.message : String(inngestErr),
      });
    }

    return NextResponse.json(
      { success: true, lead_id: leadId, status: "enrolled" },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal error";
    logger.error("Error handling inbound webhook", {
      service: "InboundWebhook",
      error: errorMsg,
    });
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
