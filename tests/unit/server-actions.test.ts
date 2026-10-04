import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateLeadStatusAction,
  approveDraftAction,
  createLeadAction,
  enrollScannedLeadsAction,
  resendFollowUpAction,
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

  it("creates leads with a server-generated UUID (never a client-shaped id)", async () => {
    const result = await createLeadAction({
      org_id: "org_1",
      name: "Test Lead",
      email: "test@example.com",
      source: "manual",
    } as any);

    expect(result.success).toBe(true);
    expect(result.lead?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("enrolls scanned leads with UUID ids, ignoring scanner/demo ids", async () => {
    const mockLeads = [
      { id: "demo_1", sender: "a.b@test.com", detectedService: "Dentistry", estimatedValue: 500 },
    ];

    const result = await enrollScannedLeadsAction("org_1", "dentist", mockLeads as any);
    expect(result.success).toBe(true);
    expect(result.createdLeads?.[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(result.createdLeads?.[0].name).toBe("a b");

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lead_id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
        }),
      })
    );
  });

  it("resend emits a dedicated sequence.resent event, not an approval", async () => {
    const result = await resendFollowUpAction("lead_resend_1");
    expect(result.success).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "app/sequence.resent",
        data: expect.objectContaining({ lead_id: "lead_resend_1" }),
      })
    );
  });
});
