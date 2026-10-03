import { SupabaseClient } from "@supabase/supabase-js";
import { Lead } from "./types";

/**
 * Production PostgreSQL repository for managing Leads with multi-tenant RLS isolation.
 */
export class LeadsRepository {
  constructor(private supabase: SupabaseClient<any, any, any>) {}

  /**
   * Fetches all leads belonging to an organization, sorted by creation date descending.
   */
  async getLeadsByOrg(orgId: string): Promise<Lead[]> {
    if (!orgId) {
      throw new Error("orgId is required to fetch leads");
    }

    const { data, error } = await this.supabase
      .from("leads")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Database error fetching leads: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseRowToLead);
  }

  /**
   * Retrieves a single lead by ID, constrained strictly to the tenant's org_id.
   */
  async getLeadById(leadId: string, orgId: string): Promise<Lead | null> {
    if (!leadId || !orgId) {
      throw new Error("leadId and orgId are required to fetch a lead");
    }

    const { data, error } = await this.supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("org_id", orgId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Record not found in Supabase PostgREST
        return null;
      }
      throw new Error(`Database error fetching lead ${leadId}: ${error.message}`);
    }

    return data ? this.mapDatabaseRowToLead(data) : null;
  }

  /**
   * Creates and inserts a new lead bound to the tenant organization.
   */
  async createLead(leadData: Partial<Lead> & { org_id: string }): Promise<Lead> {
    if (!leadData.org_id) {
      throw new Error("org_id is strictly required when creating a lead");
    }

    const row = {
      ...leadData,
      created_at: leadData.created_at ? new Date(leadData.created_at).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from("leads")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Database error inserting lead: ${error.message}`);
    }

    return this.mapDatabaseRowToLead(data);
  }

  /**
   * Updates a lead's pipeline status, verifying tenant isolation.
   */
  async updateLeadStatus(leadId: string, orgId: string, status: string): Promise<Lead> {
    if (!leadId || !orgId || !status) {
      throw new Error("leadId, orgId, and status are required for updating lead status");
    }

    const { data, error } = await this.supabase
      .from("leads")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("org_id", orgId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Database error updating lead status for ${leadId}: ${error.message}`);
    }

    return this.mapDatabaseRowToLead(data);
  }

  /**
   * Fetches all leads currently requiring human review and approval.
   */
  async getPendingApprovals(orgId: string): Promise<Lead[]> {
    if (!orgId) {
      throw new Error("orgId is required to fetch pending approvals");
    }

    const { data, error } = await this.supabase
      .from("leads")
      .select("*")
      .eq("org_id", orgId)
      .eq("approval_pending", true)
      .neq("status", "lost")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Database error fetching pending approvals: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseRowToLead);
  }

  /**
   * Deletes a lead, strictly scoped to the tenant organization.
   */
  async deleteLead(leadId: string, orgId: string): Promise<boolean> {
    if (!leadId || !orgId) {
      throw new Error("leadId and orgId are required to delete a lead");
    }

    const { error } = await this.supabase
      .from("leads")
      .delete()
      .eq("id", leadId)
      .eq("org_id", orgId);

    if (error) {
      throw new Error(`Database error deleting lead ${leadId}: ${error.message}`);
    }

    return true;
  }

  /**
   * Maps raw PostgreSQL/Supabase snake_case fields to domain Lead model.
   */
  private mapDatabaseRowToLead(row: any): Lead {
    return {
      ...row,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
      last_interaction_at: row.last_interaction_at ? new Date(row.last_interaction_at) : undefined,
    };
  }
}
