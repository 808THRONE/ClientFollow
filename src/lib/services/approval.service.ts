import { Lead } from "@/lib/db/types";

/**
 * Filters leads currently awaiting manual approval
 */
export function filterPendingApprovals(leads: Lead[]): Lead[] {
  if (!Array.isArray(leads)) return [];
  return leads.filter(
    (lead) => lead.requires_approval === true && lead.status !== "lost"
  );
}
