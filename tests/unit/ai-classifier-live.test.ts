import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyLeadIntent } from "@/lib/intelligence/classifier";

describe("Live AI Intent Classifier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies dentist inquiry using rule-based deterministic fallback when no API key is present", async () => {
    const rawMessage = "Hi, I have a cracked tooth and need an appointment with Dr. Finch this Tuesday.";
    const result = await classifyLeadIntent(rawMessage, { industry: "dentist" });

    expect(result.is_lead).toBe(true);
    expect(result.intent).toBe("new_inquiry");
    expect(result.urgency).toBe("high");
    expect(result.detected_service).toMatch(/tooth/i);
  });

  it("calls live OpenAI API when API key is provided", async () => {
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              is_lead: true,
              intent: "quote_request",
              detected_service: "Commercial Photography",
              prospect_name: "Elena Rostova",
              urgency: "medium",
              sentiment: "positive",
              confidence_score: 0.98,
            }),
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as any);

    const result = await classifyLeadIntent("Can you give me a quote for a commercial product shoot?", {
      apiKey: "sk-test-live-key",
      industry: "photographer",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test-live-key",
        }),
      })
    );
    expect(result.is_lead).toBe(true);
    expect(result.intent).toBe("quote_request");
    expect(result.prospect_name).toBe("Elena Rostova");
    expect(result.confidence_score).toBe(0.98);
  });

  it("safely falls back with contextual warning if live API throws network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const result = await classifyLeadIntent("I need a retainer agreement for commercial litigation", {
      apiKey: "sk-test-live-key",
      industry: "lawyer",
    });

    expect(result.is_lead).toBe(true);
    expect(result.intent).toBe("new_inquiry");
  });

  it("routes to local Ollama endpoint without requiring an OpenAI API key", async () => {
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              is_lead: true,
              intent: "new_inquiry",
              detected_service: "Teeth Whitening",
              prospect_name: "Sarah Connor",
              urgency: "high",
              sentiment: "positive",
              confidence_score: 0.95,
            }),
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as any);

    const result = await classifyLeadIntent("Hi, I want teeth whitening next Friday.", {
      baseUrl: "http://localhost:11434/v1",
      model: "llama3.2",
      industry: "dentist",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"llama3.2"'),
      })
    );
    expect(result.is_lead).toBe(true);
    expect(result.detected_service).toBe("Teeth Whitening");
  });
});
