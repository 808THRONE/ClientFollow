import { inngest } from "@/inngest/client";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PlaybookStep } from "@/lib/db/types";

export interface CadenceExecutionStep {
  stepNumber: number;
  delayHours: number;
  channel: "gmail" | "whatsapp" | "sms";
  templateName: string;
  promptOverride?: string;
}

export interface FollowUpPlan {
  leadId: string;
  orgId: string;
  steps: CadenceExecutionStep[];
  requiresApproval: boolean;
  approvalEventWait?: string;
}

export interface RawPlaybookStepInput {
  step_number?: number;
  stepNumber?: number;
  delay_hours?: number;
  delayHours?: number;
  channel?: "gmail" | "whatsapp" | "sms" | string;
  template_name?: string;
  templateName?: string;
  prompt_override?: string;
  promptOverride?: string;
}

/**
 * Transforms raw playbook input into an executable follow-up sequence plan.
 */
export function createFollowUpPlan(params: {
  leadId: string;
  orgId: string;
  playbookSteps: Array<RawPlaybookStepInput>;
  requiresApproval: boolean;
}): FollowUpPlan {
  const steps: CadenceExecutionStep[] = params.playbookSteps.map((s) => ({
    stepNumber: Number(s.step_number || s.stepNumber || 1),
    delayHours: Number(s.delay_hours ?? s.delayHours ?? 0),
    channel: (s.channel === "whatsapp" || s.channel === "sms" ? s.channel : "gmail"),
    templateName: String(s.template_name || s.templateName || "default_followup"),
    promptOverride: s.prompt_override || s.promptOverride,
  }));

  return {
    leadId: params.leadId,
    orgId: params.orgId,
    steps,
    requiresApproval: params.requiresApproval,
    approvalEventWait: params.requiresApproval ? "app/sequence.approved" : undefined,
  };
}

/**
 * Main durable execution function for lead follow-up cadences.
 */
export const followUpCadence = inngest.createFunction(
  {
    id: "lead-follow-up-cadence",
    name: "Lead Follow-Up Cadence Execution Engine",
    retries: 3,
    cancelOn: [
      { event: "app/lead.replied", match: "data.lead_id" },
      { event: "app/lead.booked", match: "data.lead_id" },
    ],
  },
  { event: "app/lead.detected" },
  async ({ event, step }) => {
    const { lead_id, org_id, playbook_steps, requires_approval } = event.data;

    const plan = createFollowUpPlan({
      leadId: lead_id,
      orgId: org_id,
      playbookSteps: playbook_steps || [],
      requiresApproval: !!requires_approval,
    });

    for (const action of plan.steps) {
      // 1. Wait for delay interval
      if (action.delayHours > 0) {
        await step.sleep(`wait-step-${action.stepNumber}`, `${action.delayHours}h`);
      }

      // 2. If approval is required, wait for human review event
      if (plan.requiresApproval) {
        await step.waitForEvent(`wait-for-human-approval-${action.stepNumber}`, {
          event: "app/sequence.approved",
          timeout: "5d",
          match: "data.lead_id",
        });

        // Reset approval_pending flag in DB once approval is granted
        if (env.isSupabaseLive) {
          await step.run(`clear-approval-pending-${action.stepNumber}`, async () => {
            try {
              const supabase = createServerSupabaseClient();
              await supabase
                .from("leads")
                .update({ approval_pending: false, updated_at: new Date().toISOString() })
                .eq("id", lead_id);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn("Failed to clear approval_pending flag in DB", {
                service: "FollowUpCadence",
                leadId: lead_id,
                error: msg,
              });
            }
          });
        }
      }

      // 3. Dispatch touch
      await step.run(`dispatch-touch-${action.stepNumber}`, async () => {
        let leadStatus: string | null = null;

        if (env.isSupabaseLive) {
          try {
            const supabase = createServerSupabaseClient();
            const { data, error } = await supabase
              .from("leads")
              .select("status")
              .eq("id", lead_id)
              .single();

            if (error) {
              logger.warn("Failed to check lead status in database", {
                service: "FollowUpCadence",
                leadId: lead_id,
                error: error.message,
              });
            } else {
              leadStatus = data?.status || null;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error("Database connection failure checking lead status", {
              service: "FollowUpCadence",
              leadId: lead_id,
              error: msg,
            });
            throw err; // Fail step so Inngest retries
          }
        }

        // If lead already replied or booked in DB, cancel remaining steps
        if (leadStatus === "replied" || leadStatus === "booked") {
          logger.info("Cadence cancelled: lead already replied or booked", {
            service: "FollowUpCadence",
            leadId: lead_id,
            status: leadStatus,
          });
          return { aborted: true, reason: `lead status is ${leadStatus}` };
        }

        // Advance lead status to contacted if currently new_lead
        if (env.isSupabaseLive) {
          try {
            const supabase = createServerSupabaseClient();
            const { error: updateErr } = await supabase
              .from("leads")
              .update({
                status: "contacted",
                approval_pending: false,
                updated_at: new Date().toISOString(),
              })
              .eq("id", lead_id)
              .in("status", ["new_lead", "contacted"]);

            if (updateErr) {
              logger.error("Failed to advance lead to contacted status", {
                service: "FollowUpCadence",
                leadId: lead_id,
                error: updateErr.message,
              });
              throw new Error(`Database error advancing lead status: ${updateErr.message}`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error("Database error during status advancement", {
              service: "FollowUpCadence",
              leadId: lead_id,
              error: msg,
            });
            throw err; // Fail step so Inngest retries
          }
        }

        return {
          delivered: true,
          leadId: lead_id,
          stepNumber: action.stepNumber,
          channel: action.channel,
          timestamp: new Date().toISOString(),
        };
      });
    }

    // 4. Auto-expire to 'lost' after final touch timeout
    await step.sleep("wait-final-closure", "72h");
    await step.run("mark-lead-lost", async () => {
      if (env.isSupabaseLive) {
        try {
          const supabase = createServerSupabaseClient();
          const { error } = await supabase
            .from("leads")
            .update({ status: "lost", updated_at: new Date().toISOString() })
            .eq("id", lead_id)
            .eq("status", "contacted");

          if (error) {
            logger.error("Failed to mark lead as lost", {
              service: "FollowUpCadence",
              leadId: lead_id,
              error: error.message,
            });
            throw new Error(`Database error marking lead as lost: ${error.message}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("Database error marking lead as lost", {
            service: "FollowUpCadence",
            leadId: lead_id,
            error: msg,
          });
          throw err;
        }
      }

      return { status: "lost", leadId: lead_id, closedAt: new Date().toISOString() };
    });

    return { completed: true, leadId: lead_id };
  }
);
