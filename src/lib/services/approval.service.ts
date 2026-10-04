import { Lead } from "@/lib/db/types";
import { mapServiceOrIndustryToKey } from "./playbook.service";

/**
 * Filters leads currently awaiting manual approval
 */
export function filterPendingApprovals(leads: Lead[]): Lead[] {
  if (!Array.isArray(leads)) return [];
  return leads.filter(
    (lead) => lead.requires_approval === true && lead.status !== "lost"
  );
}

/**
 * Generates an intelligent, vertical-tailored draft follow-up message for human review.
 * Reflects compliance nuances (e.g. privilege disclaimers for law, dental anxiety & flexible financing for healthcare).
 */
export function generateDraftFollowUpMessage(lead: Lead, industryOverride?: string): string {
  const firstName = (lead.name || "there").split(" ")[0].trim();
  const service = lead.detected_service || "our services";
  const industryKey = mapServiceOrIndustryToKey(industryOverride || lead.detected_service);

  switch (industryKey) {
    case "dentist":
      return `Hi ${firstName}, Dr. Smith's office noticed your inquiry regarding ${service}. We know dental visits can sometimes feel overwhelming, so we provide gentle care, sedation options, and zero-interest financing plans. We currently have two priority consultation slots open this Thursday afternoon or Friday morning. Would one of those work for a quick evaluation?`;

    case "lawyer":
      return `Dear ${firstName}, Thank you for contacting our office regarding ${service}. Please note that communications at this preliminary stage do not create a formal attorney-client relationship. Given potential statutory or filing deadlines that may apply to your matter, we recommend scheduling an initial confidential consultation. Are you available for a 15-minute phone intake tomorrow at 2:00 PM?`;

    case "photographer":
      return `Hi ${firstName}! Thanks so much for reaching out about ${service}. Your requested date is currently open on our calendar, but dates fill quickly. I'd love to share our private portfolio gallery and pricing guide with you. Would you like to schedule a 10-minute discovery chat this week to review your vision?`;

    case "home_services":
      return `Hi ${firstName}, this is our scheduling team following up on your request for ${service}. We have field technicians in your area this week and can provide an accurate on-site inspection and quote. Are you available for a brief visit tomorrow morning or afternoon?`;

    case "agency":
    default:
      return `Hi ${firstName}, following up on your inquiry regarding ${service}. We reviewed your request and analyzed a few relevant growth benchmarks. Would you be open to a brief 15-minute discovery call this Wednesday or Thursday to explore how we can assist?`;
  }
}

