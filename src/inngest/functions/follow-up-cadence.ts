import { inngest } from "@/inngest/client";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { Lead } from "@/lib/db/types";
import {
  dispatchLeadTouch,
  shouldAbortDispatch,
  runCancellationStatus,
} from "@/lib/services/dispatch.service";
import { composeFollowUpDraft } from "@/lib/services/draft.service";

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

interface OrgProfile {
  name: string | null;
  industry: string | null;
}

/**
 * Main durable execution function for lead follow-up cadences.
 *
 * Cancellation model:
 * - `cancelOn` below stops the Inngest execution itself when the lead replies,
 *   books, or the sequence is rejected.
 * - The `app/sequence.rejected` event is ALSO handled by `handleSequenceRejection`
 *   (registered at the bottom of this file), which performs the DB-side cleanup
 *   (run status + lead status). The two are complementary: cancelOn stops the
 *   runtime, the handler persists truthful audit state.
 */
export const followUpCadence = inngest.createFunction(
  {
    id: "lead-follow-up-cadence",
    name: "Lead Follow-Up Cadence Execution Engine",
    retries: 3,
    cancelOn: [
      { event: "app/lead.replied", match: "data.lead_id" },
      { event: "app/lead.booked", match: "data.lead_id" },
      { event: "app/sequence.rejected", match: "data.lead_id" },
    ],
  },
  { event: "app/lead.detected" },
  async ({ event, step }) => {
    const { lead_id, org_id, playbook_steps, requires_approval } = event.data;
    // Best-effort link to the Inngest execution for dashboard joins.
    const inngestRunId = (event as unknown as { ctx?: { run_id?: string } }).ctx?.run_id;

    const plan = createFollowUpPlan({
      leadId: lead_id,
      orgId: org_id,
      playbookSteps: playbook_steps || [],
      requiresApproval: !!requires_approval,
    });

    // Initialize or record follow_up_runs for DB-side observability (A12)
    if (env.isSupabaseLive) {
      await step.run("record-follow-up-init", async () => {
        try {
          const supabase = createServerSupabaseClient();
          await supabase.from("follow_up_runs").insert({
            lead_id,
            org_id,
            inngest_run_id: inngestRunId || null,
            current_step: 1,
            status: plan.requiresApproval ? "paused_for_approval" : "running",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn("Non-fatal: could not write initial follow_up_runs", {
            service: "FollowUpCadence",
            leadId: lead_id,
            error: msg,
          });
        }
      });
    }

    // Load the org profile once so drafts and valuations use the real
    // organization name/industry instead of hardcoded demo personas.
    let orgProfile: OrgProfile = { name: null, industry: null };
    if (env.isSupabaseLive) {
      orgProfile = await step.run("load-org-profile", async () => {
        try {
          const supabase = createServerSupabaseClient();
          const { data } = await supabase
            .from("organizations")
            .select("name, industry")
            .eq("id", org_id)
            .single();
          return { name: data?.name || null, industry: data?.industry || null };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn("Non-fatal: could not load org profile", {
            service: "FollowUpCadence",
            orgId: org_id,
            error: msg,
          });
          return { name: null, industry: null };
        }
      });
    }

    let approvedMessage: string | undefined;

    for (const action of plan.steps) {
      // 1. Wait for delay interval
      if (action.delayHours > 0) {
        await step.sleep(`wait-step-${action.stepNumber}`, `${action.delayHours}h`);
      }

      // 2. If approval is required, wait for human review event
      if (plan.requiresApproval) {
        const approval = await step.waitForEvent(`wait-for-human-approval-${action.stepNumber}`, {
          event: "app/sequence.approved",
          timeout: "5d",
          match: "data.lead_id",
        });

        // B14: Handle approval timeout gracefully to prevent unapproved dispatches
        if (!approval) {
          logger.warn("Cadence approval timed out after 5 days; marking lead unapproved and lost", {
            service: "FollowUpCadence",
            leadId: lead_id,
            stepNumber: action.stepNumber,
          });

          if (env.isSupabaseLive) {
            await step.run(`handle-approval-timeout-${action.stepNumber}`, async () => {
              try {
                const supabase = createServerSupabaseClient();
                await supabase
                  .from("leads")
                  .update({
                    approval_pending: false,
                    status: "lost",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", lead_id)
                  .in("status", ["new_lead", "contacted"]);

                await supabase
                  .from("follow_up_runs")
                  .update({
                    status: "cancelled",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("lead_id", lead_id);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.warn("Failed to update status on approval timeout", {
                  service: "FollowUpCadence",
                  leadId: lead_id,
                  error: msg,
                });
              }
            });
          }

          return { completed: false, aborted: true, reason: "approval_timeout", leadId: lead_id };
        }

        approvedMessage = (approval?.data as { approved_message?: string } | undefined)
          ?.approved_message;

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

      // 3. Dispatch touch — compose (or use the approved) message, actually send it,
      //    persist an encrypted record, and advance the lead status only on success.
      await step.run(`dispatch-touch-${action.stepNumber}`, async () => {
        if (!env.isSupabaseLive) {
          // Mock mode: no database, no live channel credentials. Do not claim delivery.
          return {
            delivered: false,
            simulated: true,
            leadId: lead_id,
            stepNumber: action.stepNumber,
            channel: action.channel,
            reason: "Supabase not live; dispatch simulated",
            timestamp: new Date().toISOString(),
          };
        }

        const supabase = createServerSupabaseClient();

        const { data, error } = await supabase
          .from("leads")
          .select("id, status, name, email, phone, detected_service, external_thread_id, last_interaction_at")
          .eq("id", lead_id)
          .eq("org_id", org_id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            logger.info("Cadence cancelled: lead no longer exists for this org", {
              service: "FollowUpCadence",
              leadId: lead_id,
            });
            await supabase
              .from("follow_up_runs")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .eq("lead_id", lead_id);
            return { delivered: false, aborted: true, reason: "lead_not_found" };
          }
          logger.error("Database connection failure checking lead status", {
            service: "FollowUpCadence",
            leadId: lead_id,
            error: error.message,
          });
          throw new Error(`Failed to load lead before dispatch: ${error.message}`);
        }

        const leadStatus = data?.status || null;

        // Never touch leads that replied, booked, were lost, or are queued over quota.
        if (shouldAbortDispatch(leadStatus)) {
          logger.info("Cadence cancelled: lead status prevents dispatch", {
            service: "FollowUpCadence",
            leadId: lead_id,
            status: leadStatus,
          });
          await supabase
            .from("follow_up_runs")
            .update({
              status: runCancellationStatus(leadStatus || "lost"),
              updated_at: new Date().toISOString(),
            })
            .eq("lead_id", lead_id);
          return { delivered: false, aborted: true, reason: `lead status is ${leadStatus}` };
        }

        const leadRow = data as unknown as Pick<
          Lead,
          "id" | "name" | "email" | "phone" | "detected_service" | "external_thread_id"
        >;

        const draft = approvedMessage
          ? { body: approvedMessage, source: "approved" as const }
          : await composeFollowUpDraft(
              leadRow as unknown as Lead,
              orgProfile.industry || undefined,
              orgProfile.name
            );

        const outcome = await dispatchLeadTouch({
          leadId: lead_id,
          orgId: org_id,
          channel: action.channel,
          messageBody: draft.body,
          stepNumber: action.stepNumber,
        });

        if (!outcome.delivered) {
          const reason = outcome.reason || "unknown";
          const dataCondition =
            reason.includes("prevents dispatch") ||
            reason.includes("Lead not found") ||
            reason.includes("no email address") ||
            reason.includes("no phone number") ||
            reason.includes("not supported in this release") ||
            reason.includes("status changed after send");

          if (dataCondition) {
            // Deterministic data problem — retrying will not help. Record truth.
            await supabase
              .from("follow_up_runs")
              .update({
                status: reason.includes("status changed after send")
                  ? runCancellationStatus(leadStatus || "lost")
                  : "cancelled",
                updated_at: new Date().toISOString(),
              })
              .eq("lead_id", lead_id);
            logger.warn("Dispatch not delivered (data condition); run recorded as cancelled", {
              service: "FollowUpCadence",
              leadId: lead_id,
              reason,
            });
            return { delivered: false, leadId: lead_id, stepNumber: action.stepNumber, channel: action.channel, reason };
          }

          // Anything else (infra/config failure) rethrows so Inngest retries.
          throw new Error(`Dispatch failed: ${reason}`);
        }

        await supabase
          .from("follow_up_runs")
          .update({
            current_step: action.stepNumber,
            status: "running",
            updated_at: new Date().toISOString(),
          })
          .eq("lead_id", lead_id);

        return {
          delivered: true,
          leadId: lead_id,
          stepNumber: action.stepNumber,
          channel: action.channel,
          messageId: outcome.messageId,
          draftSource: draft.source,
          timestamp: new Date().toISOString(),
        };
      });
    }

    // 4. Auto-expire to 'lost' after final touch timeout.
    //    Covers both new_lead (never contacted, e.g. 0-step or paused cadence)
    //    and contacted (all touches sent, no reply).
    await step.sleep("wait-final-closure", "72h");
    await step.run("mark-lead-lost", async () => {
      if (env.isSupabaseLive) {
        try {
          const supabase = createServerSupabaseClient();
          const { error } = await supabase
            .from("leads")
            .update({ status: "lost", updated_at: new Date().toISOString() })
            .eq("id", lead_id)
            .in("status", ["new_lead", "contacted"]);

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

    if (env.isSupabaseLive) {
      await step.run("record-cadence-completed", async () => {
        try {
          const supabase = createServerSupabaseClient();
          await supabase
            .from("follow_up_runs")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("lead_id", lead_id);
        } catch {
          // non-fatal
        }
      });
    }

    return { completed: true, leadId: lead_id };
  }
);

/**
 * Handles an operator's manual "resend" of a follow-up touch.
 * This is deliberately NOT an approval: it composes a fresh draft and sends one
 * touch immediately without releasing any approval lock on the running cadence.
 */
export const handleSequenceResend = inngest.createFunction(
  {
    id: "handle-sequence-resend",
    name: "Handle Manual Follow-Up Resend",
  },
  { event: "app/sequence.resent" },
  async ({ event, step }) => {
    const { lead_id, org_id } = event.data;

    if (!env.isSupabaseLive) {
      return { leadId: lead_id, simulated: true, reason: "Supabase not live; resend simulated" };
    }

    const supabase = createServerSupabaseClient();

    const { data: lead, error: leadErr } = await step.run("load-lead-for-resend", async () => {
      const result = await supabase
        .from("leads")
        .select("id, status, name, email, phone, detected_service")
        .eq("id", lead_id)
        .eq("org_id", org_id)
        .single();
      return result;
    });

    if (leadErr || !lead) {
      logger.warn("Resend ignored: lead not found for this org", {
        service: "FollowUpResend",
        leadId: lead_id,
        orgId: org_id,
      });
      return { leadId: lead_id, delivered: false, reason: "lead not found" };
    }

    if (shouldAbortDispatch(lead.status)) {
      return { leadId: lead_id, delivered: false, reason: `lead status '${lead.status}' prevents resend` };
    }

    const orgProfile = await step.run("load-org-profile-for-resend", async () => {
      try {
        const { data } = await supabase
          .from("organizations")
          .select("name, industry")
          .eq("id", org_id)
          .single();
        return { name: data?.name || null, industry: data?.industry || null };
      } catch {
        return { name: null, industry: null };
      }
    });

    const draft = await step.run("compose-resend-draft", async () => {
      return composeFollowUpDraft(
        lead as unknown as Lead,
        orgProfile.industry || undefined,
        orgProfile.name
      );
    });

    const outcome = await step.run("dispatch-resend-touch", async () => {
      return dispatchLeadTouch({
        leadId: lead_id,
        orgId: org_id,
        channel: "gmail",
        messageBody: draft.body,
        stepNumber: 1,
      });
    });

    return { leadId: lead_id, ...outcome };
  }
);

/**
 * Handles explicit sequence rejection by an operator.
 * The `cancelOn` on the cadence function stops the running execution; this
 * handler performs the DB-side cleanup so audit state is truthful.
 */
export const handleSequenceRejection = inngest.createFunction(
  {
    id: "handle-sequence-rejection",
    name: "Handle Sequence Rejection and Cancellation",
  },
  { event: "app/sequence.rejected" },
  async ({ event, step }) => {
    const { lead_id, reason } = event.data;

    await step.run("clear-approval-on-rejection", async () => {
      if (env.isSupabaseLive) {
        try {
          const supabase = createServerSupabaseClient();
          await supabase
            .from("leads")
            .update({
              approval_pending: false,
              status: "lost",
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead_id)
            .in("status", ["new_lead", "contacted"]);

          await supabase
            .from("follow_up_runs")
            .update({
              status: "cancelled_by_rejection",
              updated_at: new Date().toISOString(),
            })
            .eq("lead_id", lead_id);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn("Failed to clear approval_pending on sequence rejection", {
            service: "FollowUpCadence",
            leadId: lead_id,
            error: msg,
          });
        }
      }

      logger.info("Sequence rejected and cadence cancelled", {
        service: "FollowUpCadence",
        leadId: lead_id,
        reason: reason || "Operator rejected follow-up",
      });

      return { leadId: lead_id, rejected: true, reason };
    });
  }
);
