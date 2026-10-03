"use server";

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

function getLeadsRepo(): LeadsRepository {
  return new LeadsRepository(createServerSupabaseClient());
}

/**
 * Server action to update a lead's stage on the Kanban board with state validation.
 */
export async function updateLeadStatusAction(
  leadId: string,
  targetStatus: PipelineStatus,
  currentStatus: PipelineStatus,
  orgId: string = "org_apex_dental"
): Promise<{ success: boolean; newStatus?: PipelineStatus; error?: string }> {
  const isAllowed = canTransitionStatus(currentStatus, targetStatus);

  if (!isAllowed) {
    return {
      success: false,
      error: `Invalid status transition from '${currentStatus}' to '${targetStatus}'`,
    };
  }

  if (!orgId) {
    return { success: false, error: "orgId is required" };
  }

  if (env.isSupabaseLive) {
    try {
      const leadsRepo = getLeadsRepo();
      await leadsRepo.updateLeadStatus(leadId, orgId, targetStatus);
    } catch (err: any) {
      logger.error("Failed to update lead status", {
        service: "LeadsAction",
        leadId,
        orgId,
        targetStatus,
        error: err?.message,
      });
      return {
        success: false,
        error: `Database update failed: ${err?.message || "Unknown error"}`,
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
  orgId: string = "org_apex_dental"
): Promise<{ success: boolean; leads: Lead[]; error?: string }> {
  if (!orgId) {
    return { success: false, leads: [], error: "orgId is required" };
  }

  if (env.isSupabaseLive) {
    try {
      const leadsRepo = getLeadsRepo();
      const leads = await leadsRepo.getLeadsByOrg(orgId);
      return { success: true, leads };
    } catch (err: any) {
      logger.error("Failed to fetch leads", { service: "LeadsAction", orgId, error: err.message });
      return { success: false, leads: [], error: err.message };
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
        id: leadData.id || `lead_${Date.now()}`,
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

    // Fire Inngest event
    await inngest.send({
      name: "app/lead.detected",
      data: {
        lead_id: created.id || `lead_${Date.now()}`,
        org_id: created.org_id,
        service: created.detected_service || undefined,
        requires_approval: created.requires_approval,
      },
    });

    return { success: true, lead: created };
  } catch (err: any) {
    logger.error("Failed to create lead", { service: "LeadsAction", error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Server action to approve a pending follow-up message draft.
 */
export async function approveDraftAction(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) {
    return { success: false, error: "leadId is required" };
  }

  try {
    // Dispatch Inngest approval event to release the workflow step lock
    await inngest.send({
      name: "app/sequence.approved",
      data: {
        lead_id: leadId,
        approved_by: "system_operator",
        step_number: 1,
      },
    });

    return { success: true };
  } catch (error: any) {
    logger.error("Failed to approve draft", { service: "LeadsAction", leadId, error: error.message });
    return { success: false, error: error.message };
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

  const playbook = getPlaybookForIndustry(industry);
  const leadsRepo = getLeadsRepo();

  let enrolled = 0;
  const createdLeads: Lead[] = [];
  const errors: string[] = [];

  for (const lead of scannedLeads) {
    const leadId = lead.id || `lead_scanned_${Date.now()}_${enrolled}`;

    if (env.isSupabaseLive) {
      try {
        const created = await leadsRepo.createLead({
          id: leadId,
          org_id: orgId,
          name: lead.sender.split("@")[0].replace(".", " "),
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
      } catch (dbErr: any) {
        logger.error("Failed to create scanned lead in database", {
          service: "LeadsAction",
          leadId,
          orgId,
          error: dbErr.message,
        });
        errors.push(`Lead ${leadId}: ${dbErr.message}`);
        continue; // Skip Inngest dispatch if DB insert failed
      }
    } else {
      createdLeads.push({
        id: leadId,
        org_id: orgId,
        name: lead.sender.split("@")[0].replace(".", " "),
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
    } catch (e: any) {
      logger.warn("Inngest dispatch failed for scanned lead", {
        service: "LeadsAction",
        leadId,
        error: e.message,
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
  orgId: string = "org_apex_dental"
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) {
    return { success: false, error: "leadId is required" };
  }

  if (env.isSupabaseLive) {
    try {
      const leadsRepo = getLeadsRepo();
      await leadsRepo.deleteLead(leadId, orgId);
    } catch (err: any) {
      logger.error("Failed to delete lead", { service: "LeadsAction", leadId, orgId, error: err.message });
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

/**
 * Server action to re-trigger follow-up touch for a lead.
 */
export async function resendFollowUpAction(
  leadId: string,
  orgId: string = "org_apex_dental"
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) {
    return { success: false, error: "leadId is required" };
  }

  try {
    await inngest.send({
      name: "app/sequence.approved",
      data: {
        lead_id: leadId,
        approved_by: "manual_resend",
        step_number: 1,
      },
    });
    return { success: true };
  } catch (err: any) {
    logger.error("Failed to resend follow-up", { service: "LeadsAction", leadId, error: err.message });
    return { success: false, error: err.message };
  }
}
