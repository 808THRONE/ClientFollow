import { isHeuristicNoise } from "@/lib/intelligence/filter";
import { getPlaybookForIndustry } from "./playbook.service";
import { substituteTemplateVariables } from "./template-substitute";
import {
  INDUSTRY_DEAL_BENCHMARKS,
  calculateRecoveredPipelineValue,
  estimateLeadValue,
} from "./lead-valuation";

export { INDUSTRY_DEAL_BENCHMARKS, calculateRecoveredPipelineValue, estimateLeadValue };

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

/**
 * Scans historical email/WhatsApp threads, filtering out noise and extracting unrecovered leads.
 */
export function scanHistoricalThreads(params: {
  messages: RawHistoricalMessage[];
  industry: string;
}): ScannedLeadResult[] {
  if (!params || !Array.isArray(params.messages)) {
    return [];
  }

  const industry = (params.industry || "general").toLowerCase();
  const benchmarkConfig = INDUSTRY_DEAL_BENCHMARKS[industry] || { default: 1000, keywords: {} };
  const keywords = benchmarkConfig.keywords || {};
  const playbook = getPlaybookForIndustry(industry);
  const template = playbook.steps[0]?.template_name || "direct_touch";

  const leads: ScannedLeadResult[] = [];

  for (const msg of params.messages) {
    if (!msg) continue;

    // 1. Drop noise (receipts, noreply, newsletters)
    if (isHeuristicNoise(msg)) {
      continue;
    }

    // 2. Identify service & estimated value
    const subject = typeof msg.subject === "string" ? msg.subject : "";
    const body = typeof msg.body === "string" ? msg.body : "";
    const textToAnalyze = `${subject} ${body}`.toLowerCase();
    let estimatedValue = benchmarkConfig.default;
    let detectedService = "General Service Consultation";

    for (const [kw, value] of Object.entries(keywords)) {
      if (textToAnalyze.includes(kw)) {
        estimatedValue = value;
        detectedService = kw.charAt(0).toUpperCase() + kw.slice(1);
        break;
      }
    }

    // 3. Extract sender name approximation
    const sender = typeof msg.sender === "string" ? msg.sender : "Valued Prospect";
    const nameMatch = sender.includes("@")
      ? sender.split("@")[0].replace(/[._-]/g, " ")
      : sender.replace(/[._-]/g, " ");
    const firstName = nameMatch.charAt(0).toUpperCase() + nameMatch.slice(1);

    // 4. Formulate suggested first touch
    const suggestedTouch = substituteTemplateVariables(
      `Hi {{1}}, following up on your inquiry regarding {{2}}. Would you like to check availability this week?`,
      { first_name: firstName, service: detectedService }
    );

    leads.push({
      id: msg.id || `lead_${Date.now()}`,
      sender,
      subject,
      snippet: body.slice(0, 150),
      detectedService,
      estimatedValue,
      isUnanswered: true,
      receivedAt: msg.receivedAt || new Date(),
      suggestedFirstTouch: suggestedTouch,
    });
  }

  return leads;
}

