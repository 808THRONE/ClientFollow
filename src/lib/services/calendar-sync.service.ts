import { Lead } from "@/lib/db/types";

export interface CalendarProcessResult {
  matchedLeadId: string | null;
  newStatus?: "booked";
  inngestEvent: {
    name: "app/lead.booked";
    data: {
      lead_id: string;
      org_id: string;
      booking_time: string;
      calendar_source: string;
    };
  } | null;
}

/**
 * Processes incoming webhook payloads from Calendly or Google Calendar,
 * matches the attendee against existing open leads, and prepares the booking state update.
 */
export function processCalendarBookingPayload(
  payload: any,
  activeLeads: Array<{ id: string; email?: string | null; phone?: string | null; org_id: string; status: string }>
): CalendarProcessResult {
  const email = (payload?.invitee?.email || payload?.attendee?.email || "")
    .trim()
    .toLowerCase();
  const phone = (payload?.invitee?.phone || payload?.attendee?.phone || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (!email && !phone) {
    return { matchedLeadId: null, inngestEvent: null };
  }

  // Find match among leads that are not already booked or lost
  const matchedLead = activeLeads.find((lead) => {
    if (lead.status === "booked" || lead.status === "lost") return false;

    const leadEmail = (lead.email || "").trim().toLowerCase();
    const leadPhone = (lead.phone || "").trim().replace(/[^\d+]/g, "");

    const matchesEmail = email && leadEmail && email === leadEmail;
    const matchesPhone = phone && leadPhone && phone === leadPhone;

    return matchesEmail || matchesPhone;
  });

  if (!matchedLead) {
    return { matchedLeadId: null, inngestEvent: null };
  }

  const bookingTime = payload?.event_start_time || new Date().toISOString();

  return {
    matchedLeadId: matchedLead.id,
    newStatus: "booked",
    inngestEvent: {
      name: "app/lead.booked",
      data: {
        lead_id: matchedLead.id,
        org_id: matchedLead.org_id,
        booking_time: bookingTime,
        calendar_source: "calendly",
      },
    },
  };
}
