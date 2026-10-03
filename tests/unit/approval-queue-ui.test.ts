import { describe, it, expect } from "vitest";
import { filterPendingApprovals } from "@/lib/services/approval.service";
import { Lead } from "@/lib/db/types";

describe("Approval Queue UI Helpers & Data Model", () => {
  const mockLeads: Partial<Lead>[] = [
    {
      id: "lead_app_1",
      name: "Dr. Gregory House",
      email: "house@princeton.edu",
      phone: "+15559876543",
      source: "gmail",
      status: "new_lead",
      requires_approval: true,
      detected_service: "Diagnostic Consultation",
      detected_urgency: "high",
      sentiment: "positive",
      org_id: "org_1",
    },
    {
      id: "lead_app_2",
      name: "Lisa Cuddy",
      email: "cuddy@princeton.edu",
      phone: null,
      source: "webhook",
      status: "contacted",
      requires_approval: false,
      detected_service: "Clinic Inquiry",
      detected_urgency: "low",
      sentiment: "neutral",
      org_id: "org_1",
    },
  ];

  it("identifies leads awaiting approval and excludes autonomous leads", () => {
    const pending = filterPendingApprovals(mockLeads as Lead[]);
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe("Dr. Gregory House");
    expect(pending[0].detected_urgency).toBe("high");
  });

  it("handles empty lists gracefully", () => {
    const pending = filterPendingApprovals([]);
    expect(pending).toHaveLength(0);
  });
});
