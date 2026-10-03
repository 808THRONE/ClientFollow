import { describe, it, expect, vi } from "vitest";
import { inngest } from "@/inngest/client";
import {
  followUpCadence,
  createFollowUpPlan,
  type CadenceExecutionStep,
} from "@/inngest/functions/follow-up-cadence";

describe("Inngest Durable Workflow Engine & Cadence Logic", () => {
  it("initializes Inngest client with correct application ID", () => {
    expect(inngest.id).toBe("clientfollow");
  });

  it("configures cancelOn listeners for reply and booking events", () => {
    // Check that function configuration matches lead_id
    const cancelOn = (followUpCadence as any).opts?.cancelOn;
    expect(cancelOn).toBeDefined();
    expect(cancelOn).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "app/lead.replied", match: "data.lead_id" }),
        expect.objectContaining({ event: "app/lead.booked", match: "data.lead_id" }),
      ])
    );
  });

  it("creates accurate execution steps from playbook steps", () => {
    const rawPlaybookSteps = [
      { step_number: 1, delay_hours: 2, channel: "gmail", template_name: "gentle_touch" },
      { step_number: 2, delay_hours: 48, channel: "whatsapp", template_name: "followup_slot" },
    ];

    const plan = createFollowUpPlan({
      leadId: "lead_123",
      orgId: "org_abc",
      playbookSteps: rawPlaybookSteps,
      requiresApproval: false,
    });

    expect(plan.leadId).toBe("lead_123");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].delayHours).toBe(2);
    expect(plan.steps[1].delayHours).toBe(48);
  });

  it("identifies approval gate when requiresApproval is enabled", () => {
    const plan = createFollowUpPlan({
      leadId: "lead_legal_456",
      orgId: "org_law_firm",
      playbookSteps: [
        { step_number: 1, delay_hours: 0, channel: "gmail", template_name: "legal_consultation" },
      ],
      requiresApproval: true,
    });

    expect(plan.requiresApproval).toBe(true);
    expect(plan.approvalEventWait).toBe("app/sequence.approved");
  });
});
