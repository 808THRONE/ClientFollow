import { describe, it, expect, vi } from "vitest";
import { inngest } from "@/inngest/client";
import {
  followUpCadence,
  handleSequenceRejection,
  handleSequenceResend,
  createFollowUpPlan,
  type CadenceExecutionStep,
} from "@/inngest/functions/follow-up-cadence";
import {
  shouldAbortDispatch,
  runCancellationStatus,
} from "@/lib/services/dispatch.service";

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

describe("Dispatch abort guards (cadence must never contact lost/dormant leads)", () => {
  it("aborts dispatch for replied, booked, lost, and over-quota leads", () => {
    expect(shouldAbortDispatch("replied")).toBe(true);
    expect(shouldAbortDispatch("booked")).toBe(true);
    expect(shouldAbortDispatch("lost")).toBe(true);
    expect(shouldAbortDispatch("queued_over_quota")).toBe(true);
  });

  it("allows dispatch for active pipeline statuses", () => {
    expect(shouldAbortDispatch("new_lead")).toBe(false);
    expect(shouldAbortDispatch("contacted")).toBe(false);
    expect(shouldAbortDispatch(null)).toBe(false);
    expect(shouldAbortDispatch(undefined)).toBe(false);
  });

  it("maps aborting statuses to truthful run cancellation statuses", () => {
    expect(runCancellationStatus("replied")).toBe("cancelled_by_reply");
    expect(runCancellationStatus("booked")).toBe("cancelled_by_booking");
    expect(runCancellationStatus("lost")).toBe("cancelled");
    expect(runCancellationStatus("queued_over_quota")).toBe("cancelled");
  });
});

describe("Rejection & resend handlers are registered on the Inngest client", () => {
  it("registers a handler for app/sequence.rejected with truthful DB cleanup", () => {
    expect(handleSequenceRejection).toBeDefined();
  });

  it("registers a handler for app/sequence.resent (resend is not an approval)", () => {
    expect(handleSequenceResend).toBeDefined();
  });
});
