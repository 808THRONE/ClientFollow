import { describe, it, expect } from "vitest";
import {
  scanHistoricalThreads,
  calculateRecoveredPipelineValue,
  RawHistoricalMessage,
} from "@/lib/services/scanner.service";

describe("Revenue Recovery Scanner ('Scan Past 7 Days')", () => {
  const MOCK_HISTORICAL_EMAILS: RawHistoricalMessage[] = [
    {
      id: "msg_1",
      sender: "jessica.m@gmail.com",
      subject: "Inquiry about teeth whitening appointment",
      body: "Hi Dr. Smith, do you have any appointments available next week for professional teeth whitening?",
      receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      id: "msg_2",
      sender: "noreply@uber.com",
      subject: "Your trip receipt with Uber",
      body: "Thanks for riding. Total: $24.50",
      receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: "msg_3",
      sender: "robert.b@constructco.net",
      subject: "Looking for quote on full dental implants",
      body: "Hello, looking to get pricing and consultation details for full upper implants.",
      receivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      id: "msg_4",
      sender: "newsletter@submittable.com",
      subject: "Weekly digest of creative opportunities",
      body: "Check out this week's top picks...",
      receivedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  ];

  it("filters out noise and identifies genuine unanswered leads from the past 7 days", () => {
    const results = scanHistoricalThreads({
      messages: MOCK_HISTORICAL_EMAILS,
      industry: "dentist",
    });

    // Should filter out Uber receipt and newsletter, keeping 2 genuine inquiries
    expect(results).toHaveLength(2);
    expect(results[0].sender).toBe("jessica.m@gmail.com");
    expect(results[1].sender).toBe("robert.b@constructco.net");
    expect(results[0].isUnanswered).toBe(true);
  });

  it("calculates estimated recovered pipeline revenue based on industry service benchmarks", () => {
    const scannedLeads = [
      { detectedService: "Teeth Whitening", estimatedValue: 450 },
      { detectedService: "Full Dental Implants", estimatedValue: 3500 },
    ];

    const totalValue = calculateRecoveredPipelineValue(scannedLeads);
    expect(totalValue).toBe(3950);
  });

  it("assigns appropriate benchmark values for different service industries", () => {
    const results = scanHistoricalThreads({
      messages: MOCK_HISTORICAL_EMAILS,
      industry: "dentist",
    });

    for (const lead of results) {
      expect(lead.estimatedValue).toBeGreaterThan(0);
      expect(lead.suggestedFirstTouch).toBeDefined();
    }
  });
});
