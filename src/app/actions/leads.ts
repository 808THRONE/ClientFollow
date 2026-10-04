"use server";

import crypto from "node:crypto";
import { canTransitionStatus, PipelineStatus } from "@/lib/services/pipeline-state.service";
import { inngest } from "@/inngest/client";
import { getPlaybookForIndustry } from "@/lib/services/playbook.service";
import { ScannedLeadResult } from "@/lib/services/scanner.service";
import { LeadsRepository } from "@/lib/db/leads.repository";
import { createServerSupabaseClient } from "@/lib/db/client";
import { Lead } from "@/lib/db/types";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { DEMO_LEADS } from "@/lib/demo-data";
import { getSessionAction } from "./session";

function getLeadsRepo(): LeadsRepository {
  return new LeadsRepository(createServerSupabaseClient());
}

/**
 * Resolves the authenticated user's organization ID from session or falls back securely.
 */
async function resolveEffectiveOrgId(passedOrgId?: string): Promise<string> {
  const session = await getSessionAction();
  if (session?.orgId) {
    return session.orgId;
  }
  return passedOrgId || "org_demo";
}

/**
 * Server action to update a lead's stage on the Kanban board with state validation.
 */
export async function updateLeadStatusAction(
  leadId: string,
  targetStatus: PipelineStatus,
  currentStatus: PipelineStatus,
  orgId?: string
): Promise<{ success: boolean; newStatus?: PipelineStatus; error?: string }> {
  const isAllowed = canTransitionStatus(currentStatus, targetStatus);

  if (!isAllowed) {
    return {
      success: false,
      error: `Invalid status transition from '${currentStatus}' to '${targetStatus}'`,
    };
  }

  const effectiveOrgId = await resolveEffectiveOrgId(orgId);
  if (!effectiveOrgId) {
    return { success: false, error: "orgId is required" };
  }

  if (env.isSupabaseLive) {
    try {
      const leadsRepo = getLeadsRepo();
      await leadsRepo.updateLeadStatus(leadId, effectiveOrgId, targetStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to update lead status", {
        service: "LeadsAction",
        leadId,
        orgId: effectiveOrgId,
        targetStatus,
        error: msg,
      });
      return {
        success: false,
        error: `Database update failed: ${msg}`,
      };
    }
  }

  return {
    success: true,
    newStatus: targetStatus,
  };
}

/**
 * Server action to fetch leads for an organization.
 */
export async function getLeadsAction(
  orgId?: string
): Promise<{ success: boolean; leads: Lead[]; error?: string }> {
  const effectiveOrgId = await resolveEffectiveOrgId(orgId);
  if (!effectiveOrgId) {
    return { success: false, leads: [], error: "orgId is required" };
  }

  if (env.isSupabaseLive) {
    try {
      const leadsRepo = getLeadsRepo();
      const leads = await leadsRepo.getLeadsByOrg(effectiveOrgId);
      return { success: true, leads };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to fetch leads", { service: "LeadsAction", orgId: effectiveOrgId, error: msg });
      return { success: false, leads: [], error: msg };
    }
  }

  return { success: true, leads: DEMO_LEADS };
}

/**
 * Server action to create a new lead in the database and trigger Inngest cadence.
 */
export async function createLeadAction(
  leadData: Partial<Lead> & { org_id: string }
): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  if (!leadData.org_id) {
    return { success: false, error: "org_id is required" };
  }

  try {
    let created: Lead;

    if (env.isSupabaseLive) {
      const leadsRepo = getLeadsRepo();
      created = await leadsRepo.createLead(leadData);
    } else {
      created = {
        id: crypto.randomUUID(),
        org_id: leadData.org_id,
        name: leadData.name || "New Lead",
        email: leadData.email || "",
        phone: leadData.phone,
        source: leadData.source || "gmail",
        status: leadData.status || "new_lead",
        detected_service: leadData.detected_service,
        detected_urgency: leadData.detected_urgency || "medium",
        sentiment: leadData.sentiment || "positive",
        requires_approval: leadData.requires_approval ?? false,
        approval_pending: leadData.approval_pending ?? false,
        created_at: new Date(),
      };
    }

    let industryToUse = "general";
    if (env.isSupabaseLive) {
      try {
        const supabase = createServerSupabaseClient();
        const { data: orgData } = await supabase
          .from("organizations")
          .select("industry")
          .eq("id", created.org_id)
          .single();
        if (orgData?.industry) {
          industryToUse = orgData.industry;
        }
      } catch {
        // Fallback to detected service mapping
      }
    }
    if (industryToUse === "general" && created.detected_service) {
      industryToUse = created.detected_service;
    }

    const playbook = getPlaybookForIndustry(industryToUse);

    // Fire Inngest event with configured playbook steps
    await inngest.send({
      name: "app/lead.detected",
      data: {
        lead_id: created.id || crypto.randomUUID(),
        org_id: created.org_id,
        service: created.detected_service || undefined,
        requires_approval: created.requires_approval,
        playbook_steps: playbook.steps,
      },
    });

    return { success: true, lead: created };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to create lead", { service: "LeadsAction", error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Server action to approve a pending follow-up message draft.
 */
export async function approveDraftAction(
  leadId: string,
  options?: {
    stepId?: string;
    stepNumber?: number;
    approvedBy?: string;
    approvedMessage?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) {
    return { success: false, error: "leadId is required" };
  }

  try {
    // Dispatch canonical Inngest approval event to release the workflow step lock
    await inngest.send({
      name: "app/sequence.approved",
      data: {
        lead_id: leadId,
        step_id: options?.stepId || "step_1",
        step_number: options?.stepNumber || 1,
        approved_by: options?.approvedBy || "system_operator",
        approved_message: options?.approvedMessage,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Failed to approve draft", { service: "LeadsAction", leadId, error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Server action to batch enroll scanned leads into the active cadence and database.
 */
export async function enrollScannedLeadsAction(
  orgId: string,
  industry: string,
  scannedLeads: ScannedLeadResult[]
): Promise<{ success: boolean; enrolledCount: number; createdLeads?: Lead[]; errors?: string[] }> {
  if (!orgId) {
    return { success: false, enrolledCount: 0, errors: ["orgId is required"] };
  }

  // Enrolling leads writes real rows and fires real cadence workflows.
  // In live mode this is only allowed when the org has an active channel
  // integration — otherwise we'd be creating production leads (from sample
  // onboarding data, for example) that real follow-up sequences would target.
  if (env.isSupabaseLive) {
    try {
      const supabase = createServerSupabaseClient();
      const { data: integrations, error: integrationErr } = await supabase
        .from("channel_integrations")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "active")
        .limit(1);

      if (integrationErr || !integrations || integrations.length === 0) {
        const msg = integrationErr?.message || "no active channel integration";
        logger.warn("Enrollment blocked: org has no active channel integration", {
          service: "LeadsAction",
          orgId,
          reason: msg,
        });
        return {
          success: false,
          enrolledCount: 0,
          errors: [
            "This organization has no active channel integration. Connect Gmail or WhatsApp in Settings before enrolling leads into the cadence.",
          ],
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to check channel integrations before enrollment", {
        service: "LeadsAction",
        orgId,
        error: msg,
      });
      return {
        success: false,
        enrolledCount: 0,
        errors: [`Could not verify channel integrations: ${msg}`],
      };
    }
  }

  const playbook = getPlaybookForIndustry(industry);
  const leadsRepo = getLeadsRepo();

  let enrolled = 0;
  const createdLeads: Lead[] = [];
  const errors: string[] = [];

  for (const lead of scannedLeads) {
    // Server-generated UUID — scanner/demo ids are never written to leads.id
    const leadId = crypto.randomUUID();

    if (env.isSupabaseLive) {
      try {
        const created = await leadsRepo.createLead({
          id: leadId,
          org_id: orgId,
          name: lead.sender.split("@")[0].replace(/[._-]/g, " "),
          email: lead.sender,
          source: "gmail",
          status: "new_lead",
          detected_service: lead.detectedService,
          detected_urgency: "medium",
          sentiment: "positive",
          requires_approval: false,
          approval_pending: false,
          created_at: new Date(),
        });
        createdLeads.push(created);
      } catch (dbErr: unknown) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        logger.error("Failed to create scanned lead in database", {
          service: "LeadsAction",
          leadId,
          orgId,
          error: msg,
        });
        errors.push(`Lead ${leadId}: ${msg}`);
        continue; // Skip Inngest dispatch if DB insert failed
      }
    } else {
      createdLeads.push({
        id: leadId,
        org_id: orgId,
        name: lead.sender.split("@")[0].replace(/[._-]/g, " "),
        email: lead.sender,
        source: "gmail",
        status: "new_lead",
        detected_service: lead.detectedService,
        detected_urgency: "medium",
        sentiment: "positive",
        requires_approval: false,
        approval_pending: false,
        created_at: new Date(),
      });
    }

    try {
      await inngest.send({
        name: "app/lead.detected",
        data: {
          lead_id: leadId,
          org_id: orgId,
          service: lead.detectedService,
          requires_approval: false,
          playbook_steps: playbook.steps,
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("Inngest dispatch failed for scanned lead", {
        service: "LeadsAction",
        leadId,
        error: msg,
      });
      // Non-fatal: lead was created in DB, workflow will need manual trigger
    }

    enrolled++;
  }

  return {
    success: errors.length === 0,
    enrolledCount: enrolled,
    createdLeads,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Server action to permanently delete a lead.
 */
export async function deleteLeadAction(
  leadId: string,
  orgId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) {
    return { success: false, error: "leadId is required" };
  }

  const effectiveOrgId = await resolveEffectiveOrgId(orgId);

  if (env.isSupabaseLive) {
    try {
      const leadsRepo = getLeadsRepo();
      await leadsRepo.deleteLead(leadId, effectiveOrgId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to delete lead", { service: "LeadsAction", leadId, orgId: effectiveOrgId, error: msg });
      return { success: false, error: msg };
    }
  }

  return { success: true };
}

/**
 * Server action to manually re-send the current follow-up touch for a lead.
 * Emits a dedicated "resent" event — this is NOT an approval, so it must not
 * release the cadence's approval lock (app/sequence.approved is reserved for
 * explicit human approvals).
 */
export async function resendFollowUpAction(
  leadId: string,
  orgId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) {
    return { success: false, error: "leadId is required" };
  }

  const effectiveOrgId = await resolveEffectiveOrgId(orgId);

  try {
    await inngest.send({
      name: "app/sequence.resent",
      data: {
        lead_id: leadId,
        org_id: effectiveOrgId,
        requested_by: "manual_resend",
      },
    });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to resend follow-up", { service: "LeadsAction", leadId, error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Server action to append a private operator note to a lead.
 */
export async function saveLeadNoteAction(
  leadId: string,
  note: string,
  orgId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!leadId || !note || !note.trim()) {
    return { success: false, error: "leadId and note are required" };
  }

  const effectiveOrgId = await resolveEffectiveOrgId(orgId);
  const trimmed = note.trim();

  if (env.isSupabaseLive) {
    try {
      const supabase = createServerSupabaseClient();
      const { data: existing, error: fetchErr } = await supabase
        .from("leads")
        .select("notes")
        .eq("id", leadId)
        .eq("org_id", effectiveOrgId)
        .single();

      if (fetchErr && fetchErr.code !== "PGRST116") {
        throw new Error(`Failed to read lead notes: ${fetchErr.message}`);
      }

      const entry = `[${new Date().toISOString()}] ${trimmed}`;
      const nextNotes = existing?.notes ? `${existing.notes}\n${entry}` : entry;

      const { error: updateErr } = await supabase
        .from("leads")
        .update({ notes: nextNotes, updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .eq("org_id", effectiveOrgId);

      if (updateErr) {
        throw new Error(`Failed to save lead note: ${updateErr.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to save lead note", { service: "LeadsAction", leadId, orgId: effectiveOrgId, error: msg });
      return { success: false, error: msg };
    }
  }

  return { success: true };
}

/**
 * Server action to fetch the real activity timeline for a lead:
 * follow-up runs plus persisted outbound messages (no fabricated entries).
 */
export async function getLeadActivityAction(
  leadId: string,
  orgId?: string
): Promise<{
  success: boolean;
  items: Array<{ label: string; detail: string; at: string; kind: "created" | "run" | "message" }>;
  error?: string;
}> {
  if (!leadId) {
    return { success: false, items: [], error: "leadId is required" };
  }

  const effectiveOrgId = await resolveEffectiveOrgId(orgId);

  if (!env.isSupabaseLive) {
    return { success: true, items: [] };
  }

  try {
    const supabase = createServerSupabaseClient();
    const items: Array<{ label: string; detail: string; at: string; kind: "created" | "run" | "message" }> = [];

    const { data: leadRow, error: leadErr } = await supabase
      .from("leads")
      .select("created_at, status")
      .eq("id", leadId)
      .eq("org_id", effectiveOrgId)
      .single();

    if (leadErr && leadErr.code !== "PGRST116") {
      throw new Error(`Failed to read lead: ${leadErr.message}`);
    }

    if (leadRow?.created_at) {
      items.push({
        label: "Inbound Inquiry Logged",
        detail: "Lead created in pipeline",
        at: String(leadRow.created_at),
        kind: "created",
      });
    }

    const { data: runs, error: runsErr } = await supabase
      .from("follow_up_runs")
      .select("status, current_step, created_at, updated_at")
      .eq("lead_id", leadId)
      .eq("org_id", effectiveOrgId)
      .order("created_at", { ascending: true });

    if (runsErr) {
      throw new Error(`Failed to read follow-up runs: ${runsErr.message}`);
    }

    for (const run of runs || []) {
      const step = Number((run as { current_step?: number }).current_step || 1);
      const status = String((run as { status?: string }).status || "running");
      items.push({
        label: status === "running" ? `Cadence Step ${step} In Progress` : `Cadence ${status.replace(/_/g, " ")}`,
        detail: `Follow-up run (step ${step})`,
        at: String((run as { created_at?: string }).created_at || ""),
        kind: "run",
      });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("channel, sent_at")
      .eq("lead_id", leadId)
      .eq("org_id", effectiveOrgId)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: true });

    if (msgErr) {
      throw new Error(`Failed to read messages: ${msgErr.message}`);
    }

    for (const message of messages || []) {
      items.push({
        label: "Follow-up Touch Sent",
        detail: `Dispatched via ${String((message as { channel?: string }).channel || "channel")}`,
        at: String((message as { sent_at?: string }).sent_at || ""),
        kind: "message",
      });
    }

    return { success: true, items };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to fetch lead activity", { service: "LeadsAction", leadId, orgId: effectiveOrgId, error: msg });
    return { success: false, items: [], error: msg };
  }
}

/**
 * Server action to fetch the session user's organization profile
 * (name + industry) so the dashboard can value leads with the
 * correct industry benchmarks instead of a hardcoded default.
 */
export async function getOrgProfileAction(): Promise<{
  success: boolean;
  name: string | null;
  industry: string | null;
}> {
  const session = await getSessionAction();
  if (!session?.orgId) {
    return { success: true, name: null, industry: null };
  }

  if (!env.isSupabaseLive) {
    return { success: true, name: null, industry: null };
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("name, industry")
      .eq("id", session.orgId)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.warn("Failed to fetch org profile", { service: "LeadsAction", orgId: session.orgId, error: error.message });
      return { success: true, name: null, industry: null };
    }

    return {
      success: true,
      name: data?.name || null,
      industry: data?.industry || null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("Failed to fetch org profile", { service: "LeadsAction", orgId: session.orgId, error: msg });
    return { success: true, name: null, industry: null };
  }
}
