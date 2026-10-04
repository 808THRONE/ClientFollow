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

export type IndustryKey = "dentist" | "agency" | "photographer" | "lawyer" | "home_services" | "other";

/**
 * Normalizes an industry identifier or detected service keyword to a standard IndustryKey.
 * Prevents free-text detected services (e.g. "Dental Implants Consult") from silently failing
 * lookup and defaulting to the agency fallback.
 */
export function mapServiceOrIndustryToKey(input?: string | null): IndustryKey {
  if (!input) return "other";
  const s = input.toLowerCase().trim();

  // Direct match on supported industry keys
  if (DEFAULT_NICHE_PLAYBOOKS[s]) {
    return s as IndustryKey;
  }

  // Dental keywords
  if (
    s.includes("dent") ||
    s.includes("tooth") ||
    s.includes("teeth") ||
    s.includes("implant") ||
    s.includes("whitening") ||
    s.includes("ortho") ||
    s.includes("invisalign") ||
    s.includes("crown") ||
    s.includes("veneer") ||
    s.includes("cleaning") ||
    s.includes("cavity") ||
    s.includes("smile")
  ) {
    return "dentist";
  }

  // Legal keywords
  if (
    s.includes("law") ||
    s.includes("legal") ||
    s.includes("attorney") ||
    s.includes("counsel") ||
    s.includes("litigation") ||
    s.includes("contract") ||
    s.includes("divorce") ||
    s.includes("trademark") ||
    s.includes("estate") ||
    s.includes("court") ||
    s.includes("settlement")
  ) {
    return "lawyer";
  }

  // Photography keywords
  if (
    s.includes("photo") ||
    s.includes("portrait") ||
    s.includes("wedding") ||
    s.includes("headshot") ||
    s.includes("shoot") ||
    s.includes("gallery") ||
    s.includes("camera")
  ) {
    return "photographer";
  }

  // Home Services / Contractor keywords
  if (
    s.includes("home") ||
    s.includes("roof") ||
    s.includes("plumb") ||
    s.includes("pipe") ||
    s.includes("hvac") ||
    s.includes("leak") ||
    s.includes("remodel") ||
    s.includes("contractor") ||
    s.includes("electric") ||
    s.includes("tile") ||
    s.includes("repair")
  ) {
    return "home_services";
  }

  // Agency / Marketing keywords
  if (
    s.includes("agency") ||
    s.includes("market") ||
    s.includes("seo") ||
    s.includes("website") ||
    s.includes("campaign") ||
    s.includes("retainer") ||
    s.includes("design") ||
    s.includes("ads")
  ) {
    return "agency";
  }

  return "other";
}

/**
 * Retrieves the recommended pre-built cadence for an industry or detected service.
 */
export function getPlaybookForIndustry(industryOrService: string): NichePlaybookTemplate {
  const key = mapServiceOrIndustryToKey(industryOrService);
  return DEFAULT_NICHE_PLAYBOOKS[key] || DEFAULT_NICHE_PLAYBOOKS.agency;
}
