import { NextRequest, NextResponse } from "next/server";
import { processCalendarBookingPayload } from "@/lib/services/calendar-sync.service";
import { inngest } from "@/inngest/client";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const attendeeEmail = (payload?.invitee?.email || payload?.attendee?.email || "").trim().toLowerCase();
    const attendeePhone = (payload?.invitee?.phone || payload?.attendee?.phone || "").trim();

    let activeLeads: any[] = [];
    if (env.isSupabaseLive) {
      try {
        const supabase = createServerSupabaseClient();
        let query = supabase
          .from("leads")
          .select("id, email, phone, org_id, status")
          .not("status", "in", '("booked","lost")');

        if (attendeeEmail) {
          query = query.ilike("email", attendeeEmail);
        } else if (attendeePhone) {
          const cleanPhone = attendeePhone.replace(/^\+/, "");
          query = query.or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`);
        }

        const { data, error } = await query.limit(5);

        if (!error && Array.isArray(data)) {
          activeLeads = data;
        }
      } catch (err: any) {
        logger.warn("Calendar webhook database lookup warning", {
          service: "CalendarWebhook",
          error: err?.message,
        });
      }
    }

    const result = processCalendarBookingPayload(payload, activeLeads);

    if (result.matchedLeadId && result.inngestEvent) {
      if (env.isSupabaseLive) {
        try {
          const supabase = createServerSupabaseClient();
          await supabase
            .from("leads")
            .update({ status: "booked", updated_at: new Date().toISOString() })
            .eq("id", result.matchedLeadId)
            .neq("status", "booked");
        } catch (err: any) {
          logger.warn("Failed to update lead status to booked in database", {
            service: "CalendarWebhook",
            leadId: result.matchedLeadId,
            error: err?.message,
          });
        }
      }

      try {
        await inngest.send({
          name: result.inngestEvent.name,
          data: result.inngestEvent.data,
        });
      } catch (inngestErr: any) {
        logger.warn("Inngest dispatch warning on calendar booking", {
          service: "CalendarWebhook",
          error: inngestErr?.message,
        });
      }

      return NextResponse.json({
        success: true,
        matched: true,
        matchedLeadId: result.matchedLeadId,
        status: "booked",
      });
    }

    logger.info("Calendar booking received but no matching lead found in database", {
      service: "CalendarWebhook",
      attendeeEmail: attendeeEmail || undefined,
      attendeePhone: attendeePhone || undefined,
    });

    return NextResponse.json({
      success: true,
      matched: false,
      message: "Booking received but no matching active lead found",
    });
  } catch (error: any) {
    logger.error("Error processing booking webhook", {
      service: "CalendarWebhook",
      error: error.message,
    });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
