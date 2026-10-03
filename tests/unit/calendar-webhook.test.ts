import { describe, it, expect, vi } from "vitest";
import { processCalendarBookingPayload } from "@/lib/services/calendar-sync.service";

describe("Calendar Webhook & Auto-Booking Synchronization", () => {
  it("extracts attendee email and matches lead for auto-booking", () => {
    const payload = {
      event_type: "invitee.created",
      event_start_time: "2026-10-01T14:00:00Z",
      invitee: {
        email: "sarah.m@example.com",
        name: "Sarah Miller",
        phone: "+15551234567",
      },
    };

    const mockLeads = [
      { id: "lead_1", email: "sarah.m@example.com", phone: "+15551234567", status: "contacted", org_id: "org_1" },
      { id: "lead_2", email: "bob@example.com", phone: null, status: "new_lead", org_id: "org_1" },
    ];

    const result = processCalendarBookingPayload(payload, mockLeads as any);

    expect(result.matchedLeadId).toBe("lead_1");
    expect(result.newStatus).toBe("booked");
    expect(result.inngestEvent).toEqual({
      name: "app/lead.booked",
      data: {
        lead_id: "lead_1",
        org_id: "org_1",
        booking_time: "2026-10-01T14:00:00Z",
        calendar_source: "calendly",
      },
    });
  });

  it("returns null when no matching lead is found", () => {
    const payload = {
      event_type: "invitee.created",
      event_start_time: "2026-10-01T14:00:00Z",
      invitee: {
        email: "unknown.person@example.com",
      },
    };

    const mockLeads = [
      { id: "lead_1", email: "sarah.m@example.com", phone: null, status: "contacted", org_id: "org_1" },
    ];

    const result = processCalendarBookingPayload(payload, mockLeads as any);
    expect(result.matchedLeadId).toBeNull();
    expect(result.inngestEvent).toBeNull();
  });

  it("handles missing email/phone gracefully", () => {
    const payload = {};
    const result = processCalendarBookingPayload(payload, []);
    expect(result.matchedLeadId).toBeNull();
  });
});
