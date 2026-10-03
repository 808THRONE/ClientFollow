import { describe, it, expect } from "vitest";
import { isHeuristicNoise } from "@/lib/intelligence/filter";
import { parseLeadIntentFromLLM } from "@/lib/intelligence/classifier";

describe("Inbound Intelligence & AI Intent Classifier", () => {
  describe("Heuristic Noise Filter", () => {
    it("drops automated receipts and invoices", () => {
      const email = {
        sender: "invoices@stripe.com",
        subject: "Your receipt for Stripe Subscription #1234",
        body: "Thanks for your payment of $49.00.",
      };
      expect(isHeuristicNoise(email)).toBe(true);
    });

    it("drops automated noreply senders", () => {
      const email = {
        sender: "noreply@github.com",
        subject: "Security alert for repository",
        body: "A new security advisory was published.",
      };
      expect(isHeuristicNoise(email)).toBe(true);
    });

    it("allows prospective client inquiries to pass through", () => {
      const email = {
        sender: "john.doe.homeowner@gmail.com",
        subject: "Quote for roof repair",
        body: "Hi, I have a leak over my kitchen. How much would it cost to get an inspection this week?",
      };
      expect(isHeuristicNoise(email)).toBe(false);
    });
  });

  describe("LLM Structured Output Parsing", () => {
    it("correctly parses valid LLM classification JSON", () => {
      const rawLLMOutput = JSON.stringify({
        is_lead: true,
        intent: "quote_request",
        detected_service: "Roof Replacement",
        prospect_name: "John Doe",
        urgency: "high",
        sentiment: "positive",
        confidence_score: 0.95,
      });

      const parsed = parseLeadIntentFromLLM(rawLLMOutput);
      expect(parsed.is_lead).toBe(true);
      expect(parsed.intent).toBe("quote_request");
      expect(parsed.detected_service).toBe("Roof Replacement");
      expect(parsed.prospect_name).toBe("John Doe");
    });

    it("gracefully falls back when LLM outputs malformed markdown block", () => {
      const rawMarkdown = "```json\n" + JSON.stringify({
        is_lead: true,
        intent: "new_inquiry",
        detected_service: "Dental Cleaning",
        prospect_name: "Sarah",
        urgency: "medium",
        sentiment: "neutral",
        confidence_score: 0.88,
      }) + "\n```";

      const parsed = parseLeadIntentFromLLM(rawMarkdown);
      expect(parsed.is_lead).toBe(true);
      expect(parsed.detected_service).toBe("Dental Cleaning");
    });

    it("handles non-lead output properly", () => {
      const rawLLMOutput = JSON.stringify({
        is_lead: false,
        intent: "spam",
        detected_service: null,
        prospect_name: null,
        urgency: "low",
        sentiment: "neutral",
        confidence_score: 0.99,
      });

      const parsed = parseLeadIntentFromLLM(rawLLMOutput);
      expect(parsed.is_lead).toBe(false);
      expect(parsed.intent).toBe("spam");
    });
  });
});
