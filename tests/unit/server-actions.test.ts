import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateLeadStatusAction,
  approveDraftAction,
  enrollScannedLeadsAction,
} from "@/app/actions/leads";
import { inngest } from "@/inngest/client";

// Mock Inngest client
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["evt_123"] }),
  },
}));

describe("Server Actions: Lead Management & Approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits valid pipeline status transitions", async () => {
    const result = await updateLeadStatusAction("lead_1", "contacted", "new_lead");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("contacted");
  });

  it("rejects forbidden status transitions", async () => {
    // Cannot transition from booked directly to new_lead
    const result = await updateLeadStatusAction("lead_1", "new_lead", "booked");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid status transition");
  });

  it("approves draft and dispatches app/sequence.approved event", async () => {
    const result = await approveDraftAction("lead_approval_123");
    expect(result.success).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "app/sequence.approved",
        data: expect.objectContaining({ lead_id: "lead_approval_123" }),
      })
    );
  });

  it("batch enrolls scanned leads into Inngest", async () => {
    const mockLeads = [
      { sender: "a@test.com", detectedService: "Dentistry", estimatedValue: 500 },
      { sender: "b@test.com", detectedService: "Ortho", estimatedValue: 3000 },
    ];

    const result = await enrollScannedLeadsAction("org_1", "dentist", mockLeads as any);
    expect(result.success).toBe(true);
    expect(result.enrolledCount).toBe(2);
    expect(inngest.send).toHaveBeenCalledTimes(2);
  });
});
