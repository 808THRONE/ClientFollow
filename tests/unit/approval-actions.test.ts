import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  approveLeadSequence,
  rejectLeadSequence,
} from "@/app/actions/approval";
import { filterPendingApprovals } from "@/lib/services/approval.service";
import { inngest } from "@/inngest/client";

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["mock-approval-event"] }),
  },
}));

describe("Approval Queue Service & Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters leads that require manual approval", () => {
    const leads = [
      { id: "lead_1", name: "Dr. Evans", requires_approval: true, status: "new_lead" },
      { id: "lead_2", name: "Sarah Connor", requires_approval: false, status: "contacted" },
      { id: "lead_3", name: "John Doe", requires_approval: true, status: "new_lead" },
      { id: "lead_4", name: "Expired Lead", requires_approval: true, status: "lost" },
    ];

    const pending = filterPendingApprovals(leads as any);
    expect(pending).toHaveLength(2);
    expect(pending.map((l) => l.id)).toEqual(["lead_1", "lead_3"]);
  });

  it("approves lead sequence and sends Inngest approval event with optional edited text", async () => {
    const result = await approveLeadSequence({
      leadId: "lead_100",
      stepId: "step_2",
      editedMessage: "Hi Dr. Evans, just following up regarding your tooth implant inquiry!",
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe("lead_100");
    expect(inngest.send).toHaveBeenCalledWith({
      name: "app/sequence.approved",
      data: {
        lead_id: "lead_100",
        step_id: "step_2",
        step_number: 1,
        approved_by: "system_operator",
        approved_message: "Hi Dr. Evans, just following up regarding your tooth implant inquiry!",
      },
    });
  });

  it("rejects lead sequence and cancels the follow-up flow", async () => {
    const result = await rejectLeadSequence({
      leadId: "lead_100",
      reason: "Lead is already in negotiation via phone call",
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe("lead_100");
    expect(inngest.send).toHaveBeenCalledWith({
      name: "app/sequence.rejected",
      data: {
        lead_id: "lead_100",
        reason: "Lead is already in negotiation via phone call",
      },
    });
  });

  it("fails gracefully if leadId is missing", async () => {
    const result = await approveLeadSequence({
      leadId: "",
      stepId: "step_1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
