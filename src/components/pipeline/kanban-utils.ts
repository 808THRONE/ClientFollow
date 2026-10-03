import { Lead } from "@/lib/db/types";

export type ColumnKey = "new_lead" | "contacted" | "replied" | "booked" | "lost";

export interface GroupedColumns {
  new_lead: Lead[];
  contacted: Lead[];
  replied: Lead[];
  booked: Lead[];
  lost: Lead[];
}

export interface BadgeInfo {
  label: string;
  variant: "default" | "warning" | "destructive" | "success" | "secondary";
}

/**
 * Groups leads into the 5 Kanban dashboard columns.
 */
export function groupLeadsByColumn(leads: Lead[]): GroupedColumns {
  const result: GroupedColumns = {
    new_lead: [],
    contacted: [],
    replied: [],
    booked: [],
    lost: [],
  };

  for (const lead of leads) {
    const status = (lead.status in result ? lead.status : "new_lead") as ColumnKey;
    result[status].push(lead);
  }

  return result;
}

/**
 * Determines the visual status badge for a lead card.
 */
export function formatLeadBadge(lead: Lead): BadgeInfo {
  if (lead.approval_pending) {
    return { label: "Needs Approval", variant: "warning" };
  }

  switch (lead.status) {
    case "replied":
      return { label: "Takeover Needed", variant: "destructive" };
    case "booked":
      return { label: "Booked 🎉", variant: "success" };
    case "contacted":
      return { label: "Follow-up Active", variant: "default" };
    case "lost":
      return { label: "Closed / Lost", variant: "secondary" };
    case "queued_over_quota":
      return { label: "Over Quota (Queued)", variant: "warning" };
    default:
      return { label: "New Lead", variant: "default" };
  }
}
