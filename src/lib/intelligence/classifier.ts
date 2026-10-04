import { z } from "zod";
import { env } from "@/lib/env";

export const LeadClassificationSchema = z.object({
  is_lead: z.boolean().describe("True if sender is inquiring about services, quotes, or bookings"),
  intent: z.enum([
    "new_inquiry",
    "quote_request",
    "reschedule",
    "customer_support",
    "spam",
    "other",
  ]),
  detected_service: z.string().nullable().describe("Specific service requested, e.g. 'Teeth Whitening', 'Kitchen Tile Remodel'"),
  prospect_name: z.string().nullable().describe("Extracted first and last name of the sender"),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  sentiment: z.enum(["neutral", "positive", "objection", "unsubscribed"]).default("neutral"),
  confidence_score: z.number().min(0).max(1).default(0.9),
});

export type LeadClassification = z.infer<typeof LeadClassificationSchema>;

export interface ClassifyOptions {
  industry?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Parses and validates raw LLM output (supporting markdown json codeblocks)
 */
export function parseLeadIntentFromLLM(rawOutput: string): LeadClassification {
  let cleaned = rawOutput.trim();

  // Strip markdown code fence if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  try {
    const json = JSON.parse(cleaned);
    return LeadClassificationSchema.parse(json);
  } catch {
    // Resilient fallback for non-lead / unparseable
    return {
      is_lead: false,
      intent: "other",
      detected_service: null,
      prospect_name: null,
      urgency: "low",
      sentiment: "neutral",
      confidence_score: 0.1,
    };
  }
}

/**
 * Live AI Intent Classifier with OpenAI/Ollama REST execution and deterministic fallback.
 */
export async function classifyLeadIntent(
  rawText: string,
  options: ClassifyOptions = {}
): Promise<LeadClassification> {
  const sanitized = (rawText || "").replace(/\0/g, "").trim().slice(0, 4000);
  if (!sanitized) {
    return {
      is_lead: false,
      intent: "other",
      detected_service: null,
      prospect_name: null,
      urgency: "low",
      sentiment: "neutral",
      confidence_score: 0.0,
    };
  }

  const rawBaseUrl = options.baseUrl || env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const isLocalEndpoint = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes("ollama");

  const apiKey = options.apiKey || env.OPENAI_API_KEY || (isLocalEndpoint ? "ollama" : undefined);
  const model = options.model || env.OPENAI_MODEL || (isLocalEndpoint ? "llama3.2" : "gpt-4o-mini");

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 8000);

      const systemPrompt = `You are an expert sales lead classification assistant for a ${options.industry || "service"} business.
Analyze the inbound communication from a prospective customer and output a strictly valid JSON object matching this schema:
{
  "is_lead": boolean,
  "intent": "new_inquiry" | "quote_request" | "reschedule" | "customer_support" | "spam" | "other",
  "detected_service": string or null,
  "prospect_name": string or null,
  "urgency": "low" | "medium" | "high",
  "sentiment": "neutral" | "positive" | "objection" | "unsubscribed",
  "confidence_score": float between 0.0 and 1.0
}`;

      const endpoint = `${baseUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sanitized },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return parseLeadIntentFromLLM(content);
        }
      } else {
        const errorText = await response.text();
        console.warn(`[AI Classifier] OpenAI API returned HTTP ${response.status}: ${errorText}. Using deterministic fallback.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI Classifier] Network error during AI classification: ${msg}. Falling back to deterministic analysis.`);
    }
  }

  // Deterministic Rule-Based Fallback Engine
  return ruleBasedFallback(sanitized, options.industry);
}

function ruleBasedFallback(text: string, industry?: string): LeadClassification {
  const lower = text.toLowerCase();

  // Spam detection
  if (lower.includes("crypto") || lower.includes("casino") || lower.includes("wire money") || lower.includes("viagra")) {
    return {
      is_lead: false,
      intent: "spam",
      detected_service: null,
      prospect_name: null,
      urgency: "low",
      sentiment: "neutral",
      confidence_score: 0.95,
    };
  }

  // Opt-out detection
  if (lower.includes("unsubscribe") || lower.includes("stop") || lower.includes("do not contact")) {
    return {
      is_lead: false,
      intent: "other",
      detected_service: null,
      prospect_name: null,
      urgency: "low",
      sentiment: "unsubscribed",
      confidence_score: 0.99,
    };
  }

  // Urgency detection
  const isUrgent =
    lower.includes("urgent") ||
    lower.includes("emergency") ||
    lower.includes("cracked") ||
    lower.includes("asap") ||
    lower.includes("pain") ||
    lower.includes("leak") ||
    lower.includes("today") ||
    lower.includes("tomorrow");

  // Industry keywords & service detection
  let detectedService: string | null = null;
  if (lower.includes("tooth") || lower.includes("teeth") || lower.includes("dentist") || lower.includes("cleaning") || lower.includes("whitening")) {
    detectedService = lower.includes("tooth") ? "Tooth Treatment / Emergency" : "Dental Service";
  } else if (lower.includes("photo") || lower.includes("shoot") || lower.includes("portrait") || lower.includes("wedding")) {
    detectedService = "Photography Session";
  } else if (lower.includes("lawyer") || lower.includes("legal") || lower.includes("retainer") || lower.includes("litigation") || lower.includes("contract")) {
    detectedService = "Legal Consultation";
  } else if (lower.includes("website") || lower.includes("seo") || lower.includes("marketing") || lower.includes("campaign")) {
    detectedService = "Agency Marketing / Web";
  } else if (lower.includes("pipe") || lower.includes("roof") || lower.includes("plumbing") || lower.includes("tile") || lower.includes("remodel")) {
    detectedService = "Home Service Remodel / Repair";
  }

  const isQuote = lower.includes("quote") || lower.includes("price") || lower.includes("how much") || lower.includes("estimate") || lower.includes("rates");
  const isReschedule = lower.includes("reschedule") || lower.includes("move appointment") || lower.includes("change time");

  let intent: LeadClassification["intent"] = "new_inquiry";
  if (isReschedule) intent = "reschedule";
  else if (isQuote) intent = "quote_request";

  const isLead = Boolean(detectedService || isQuote || lower.includes("appointment") || lower.includes("book") || lower.includes("schedule"));

  return {
    is_lead: isLead,
    intent,
    detected_service: detectedService || (isLead ? "General Consultation" : null),
    prospect_name: null,
    urgency: isUrgent ? "high" : "medium",
    sentiment: lower.includes("thank") || lower.includes("great") ? "positive" : "neutral",
    confidence_score: isLead ? 0.88 : 0.4,
  };
}
