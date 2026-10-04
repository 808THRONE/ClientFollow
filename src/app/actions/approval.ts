"use server";

import { inngest } from "@/inngest/client";
import { getSessionAction } from "./session";

export interface ApproveSequenceInput {
  leadId: string;
  stepId?: string;
  stepNumber?: number;
  editedMessage?: string;
  approvedBy?: string;
}

export interface RejectSequenceInput {
  leadId: string;
  reason?: string;
}

/**
 * Server Action: Approves a pending follow-up step and resumes the Inngest sequence
 */
export async function approveLeadSequence(input: ApproveSequenceInput) {
  if (!input.leadId || input.leadId.trim() === "") {
    return { success: false, error: "Lead ID is required" };
  }

  try {
    const session = await getSessionAction();
    const effectiveApprover = input.approvedBy || session?.email || "system_operator";

    await inngest.send({
      name: "app/sequence.approved",
      data: {
        lead_id: input.leadId,
        step_id: input.stepId || "step_1",
        step_number: input.stepNumber || 1,
        approved_by: effectiveApprover,
        approved_message: input.editedMessage,
      },
    });

    return {
      success: true,
      leadId: input.leadId,
      message: "Sequence step approved and dispatched",
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to approve sequence";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Server Action: Rejects a pending follow-up step and cancels or pauses the cadence
 */
export async function rejectLeadSequence(input: RejectSequenceInput) {
  if (!input.leadId || input.leadId.trim() === "") {
    return { success: false, error: "Lead ID is required" };
  }

  try {
    await inngest.send({
      name: "app/sequence.rejected",
      data: {
        lead_id: input.leadId,
        reason: input.reason || "Manual rejection by user",
      },
    });

    return {
      success: true,
      leadId: input.leadId,
      message: "Sequence rejected and cancelled",
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to reject sequence";
    return {
      success: false,
      error: msg,
    };
  }
}
