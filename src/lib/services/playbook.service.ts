import { PlaybookStep } from "@/lib/db/types";

export interface NichePlaybookTemplate {
  name: string;
  industry: "dentist" | "agency" | "photographer" | "lawyer" | "home_services" | "other";
  steps: PlaybookStep[];
}

export const DEFAULT_NICHE_PLAYBOOKS: Record<string, NichePlaybookTemplate> = {
  dentist: {
    name: "Dental Practice Lead Recovery & Recare",
    industry: "dentist",
    steps: [
      {
        step_number: 1,
        delay_hours: 0.25, // 15 mins
        channel: "gmail",
        template_name: "direct_answer_booking_link",
        prompt_override: "Tone: warm, welcoming, address dental anxiety, highlight open chair slots",
      },
      {
        step_number: 2,
        delay_hours: 48,
        channel: "whatsapp",
        template_name: "followup_gentle_reminder",
        prompt_override: "Tone: friendly reminder regarding consultation availability",
      },
      {
        step_number: 3,
        delay_hours: 120, // 5 days
        channel: "gmail",
        template_name: "faq_reassurance",
        prompt_override: "Tone: informative, mention flexible payment plans and gentle sedation options",
      },
    ],
  },
  agency: {
    name: "Digital Agency Discovery & Retainer Closing",
    industry: "agency",
    steps: [
      {
        step_number: 1,
        delay_hours: 24,
        channel: "gmail",
        template_name: "value_first_checkin",
        prompt_override: "Tone: confident, metrics-driven, share relevant growth benchmark",
      },
      {
        step_number: 2,
        delay_hours: 96, // 4 days
        channel: "gmail",
        template_name: "portfolio_asset_share",
        prompt_override: "Tone: authoritative, attach relevant case study and invite to 15-min discovery call",
      },
      {
        step_number: 3,
        delay_hours: 216, // 9 days
        channel: "gmail",
        template_name: "gentle_breakup",
        prompt_override: "Tone: respectful, close file politely while leaving door open",
      },
    ],
  },
  photographer: {
    name: "Wedding & Portrait Date Hold Cadence",
    industry: "photographer",
    steps: [
      {
        step_number: 1,
        delay_hours: 24,
        channel: "gmail",
        template_name: "date_check_pricing_guide",
        prompt_override: "Tone: excited, creative, confirm date availability and link portfolio pricing",
      },
      {
        step_number: 2,
        delay_hours: 72, // 3 days
        channel: "whatsapp",
        template_name: "date_hold_warning",
        prompt_override: "Tone: gentle urgency, offer first right of refusal before releasing date",
      },
      {
        step_number: 3,
        delay_hours: 168, // 7 days
        channel: "gmail",
        template_name: "mini_gallery_preview",
        prompt_override: "Tone: artistic, share sample full gallery link",
      },
    ],
  },
  lawyer: {
    name: "Legal Consultation & Privilege Intake",
    industry: "lawyer",
    steps: [
      {
        step_number: 1,
        delay_hours: 24,
        channel: "gmail",
        template_name: "formal_consultation_offer",
        prompt_override: "Tone: formal, strictly professional, attorney-client privilege reminder, no emojis",
      },
      {
        step_number: 2,
        delay_hours: 96, // 4 days
        channel: "gmail",
        template_name: "statutory_deadline_warning",
        prompt_override: "Tone: formal, remind client of potential statutory or filing deadlines",
      },
      {
        step_number: 3,
        delay_hours: 240, // 10 days
        channel: "gmail",
        template_name: "file_closure_notice",
        prompt_override: "Tone: formal notice of preliminary inquiry file closure",
      },
    ],
  },
  home_services: {
    name: "Contractor Quote Acceptance & Site Inspection",
    industry: "home_services",
    steps: [
      {
        step_number: 1,
        delay_hours: 2,
        channel: "whatsapp",
        template_name: "fast_quote_verification",
        prompt_override: "Tone: direct, helpful, ask if estimate was received",
      },
      {
        step_number: 2,
        delay_hours: 24,
        channel: "gmail",
        template_name: "proposal_scope_walkthrough",
        prompt_override: "Tone: detail-oriented, highlight warranty, offer 10-min site inspection",
      },
      {
        step_number: 3,
        delay_hours: 96, // 4 days
        channel: "whatsapp",
        template_name: "crew_scheduling_notice",
        prompt_override: "Tone: neighborhood crew scheduling opportunity, offer multi-job discount",
      },
    ],
  },
};

/**
 * Retrieves the recommended pre-built cadence for an industry.
 */
export function getPlaybookForIndustry(industry: string): NichePlaybookTemplate {
  const normalized = industry.toLowerCase();
  return DEFAULT_NICHE_PLAYBOOKS[normalized] || DEFAULT_NICHE_PLAYBOOKS.agency;
}
