import { isHeuristicNoise } from "@/lib/intelligence/filter";
import { getPlaybookForIndustry } from "./playbook.service";
import { substituteTemplateVariables } from "./channel-dispatcher.service";

export interface RawHistoricalMessage {
  id: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface ScannedLeadResult {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  detectedService: string;
  estimatedValue: number;
  isUnanswered: boolean;
  receivedAt: Date;
  suggestedFirstTouch: string;
}

const INDUSTRY_DEAL_BENCHMARKS: Record<string, { default: number; keywords: Record<string, number> }> = {
  dentist: {
    default: 450,
    keywords: {
      implant: 3500,
      invisalign: 4000,
      ortho: 3500,
      whitening: 450,
      crown: 1200,
      veneers: 5000,
      cleaning: 250,
    },
  },
  agency: {
    default: 3500,
    keywords: {
      retainer: 5000,
      seo: 3000,
      ads: 4000,
      website: 7500,
      redesign: 8000,
    },
  },
  photographer: {
    default: 2000,
    keywords: {
      wedding: 3500,
      elopement: 2200,
      portrait: 600,
      headshots: 450,
      commercial: 4000,
    },
  },
  lawyer: {
    default: 2500,
    keywords: {
      incorporation: 1500,
      trademark: 1800,
      litigation: 6000,
      divorce: 4500,
      estate: 3000,
    },
  },
  home_services: {
    default: 1800,
    keywords: {
      roof: 7500,
      hvac: 5500,
      plumbing: 1200,
      remodel: 9000,
      leak: 850,
    },
  },
};

/**
 * Scans historical email/WhatsApp threads, filtering out noise and extracting unrecovered leads.
 */
export function scanHistoricalThreads(params: {
  messages: RawHistoricalMessage[];
  industry: string;
}): ScannedLeadResult[] {
  const industry = params.industry.toLowerCase();
  const benchmarkConfig = INDUSTRY_DEAL_BENCHMARKS[industry] || { default: 1000, keywords: {} };
  const playbook = getPlaybookForIndustry(industry);
  const template = playbook.steps[0]?.template_name || "direct_touch";

  const leads: ScannedLeadResult[] = [];

  for (const msg of params.messages) {
    // 1. Drop noise (receipts, noreply, newsletters)
    if (isHeuristicNoise(msg)) {
      continue;
    }

    // 2. Identify service & estimated value
    const textToAnalyze = `${msg.subject} ${msg.body}`.toLowerCase();
    let estimatedValue = benchmarkConfig.default;
    let detectedService = "General Service Consultation";

    for (const [kw, value] of Object.entries(benchmarkConfig.keywords)) {
      if (textToAnalyze.includes(kw)) {
        estimatedValue = value;
        detectedService = kw.charAt(0).toUpperCase() + kw.slice(1);
        break;
      }
    }

    // 3. Extract sender name approximation
    const nameMatch = msg.sender.split("@")[0].replace(/[._-]/g, " ");
    const firstName = nameMatch.charAt(0).toUpperCase() + nameMatch.slice(1);

    // 4. Formulate suggested first touch
    const suggestedTouch = substituteTemplateVariables(
      `Hi {{1}}, following up on your inquiry regarding {{2}}. Would you like to check availability this week?`,
      { first_name: firstName, service: detectedService }
    );

    leads.push({
      id: msg.id,
      sender: msg.sender,
      subject: msg.subject,
      snippet: msg.body.slice(0, 150),
      detectedService,
      estimatedValue,
      isUnanswered: true,
      receivedAt: msg.receivedAt,
      suggestedFirstTouch: suggestedTouch,
    });
  }

  return leads;
}

/**
 * Calculates aggregate pipeline revenue across scanned leads.
 */
export function calculateRecoveredPipelineValue(leads: Array<{ estimatedValue: number }>): number {
  return leads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
}
