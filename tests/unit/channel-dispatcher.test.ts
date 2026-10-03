import { describe, it, expect, vi } from "vitest";
import {
  ChannelDispatcherService,
  WhatsAppDispatchPayload,
  isInside24HourWindow,
  substituteTemplateVariables,
} from "@/lib/services/channel-dispatcher.service";

describe("ChannelDispatcherService (Gmail & Meta WhatsApp Cloud API)", () => {
  describe("WhatsApp 24-Hour Care Window Rules", () => {
    it("returns true when last lead interaction was within 24 hours", () => {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      expect(isInside24HourWindow(twelveHoursAgo)).toBe(true);
    });

    it("returns false when last lead interaction was older than 24 hours", () => {
      const now = new Date();
      const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      expect(isInside24HourWindow(twentyFiveHoursAgo)).toBe(false);
    });

    it("returns false when lead has never interacted (outbound cold inquiry)", () => {
      expect(isInside24HourWindow(null)).toBe(false);
    });
  });

  describe("WhatsApp HSM Template Variable Substitution", () => {
    it("substitutes {{1}}, {{2}}, and {{3}} with lead variables", () => {
      const templateText = "Hi {{1}}, Dr. Smith's office following up on {{2}}. Book here: {{3}}";
      const vars = {
        first_name: "Sarah",
        service: "Teeth Whitening",
        booking_link: "https://cal.com/apex-dental/slot",
      };

      const result = substituteTemplateVariables(templateText, vars);
      expect(result).toBe(
        "Hi Sarah, Dr. Smith's office following up on Teeth Whitening. Book here: https://cal.com/apex-dental/slot"
      );
    });

    it("provides fallback for missing first name", () => {
      const templateText = "Hi {{1}}, checking in about {{2}}.";
      const vars = {
        first_name: "",
        service: "Roof Estimate",
      };

      const result = substituteTemplateVariables(templateText, vars);
      expect(result).toBe("Hi there, checking in about Roof Estimate.");
    });
  });

  describe("Outbound Payload Formulation", () => {
    it("constructs an HSM template payload when outside 24h window", () => {
      const payload: WhatsAppDispatchPayload = ChannelDispatcherService.buildWhatsAppPayload({
        recipientPhone: "+15551234567",
        lastInteractionAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h ago
        templateName: "followup_gentle_reminder",
        languageCode: "en_US",
        variables: ["Sarah", "Dental Exam", "https://cal.com/slot"],
        freeFormText: "Dynamic text that should be ignored outside 24h",
      });

      expect(payload.type).toBe("template");
      expect(payload.template).toBeDefined();
      expect(payload.template?.name).toBe("followup_gentle_reminder");
      expect(payload.template?.components[0].parameters).toHaveLength(3);
    });

    it("constructs a free-form text payload when inside 24h window", () => {
      const payload: WhatsAppDispatchPayload = ChannelDispatcherService.buildWhatsAppPayload({
        recipientPhone: "+15551234567",
        lastInteractionAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        templateName: "followup_gentle_reminder",
        languageCode: "en_US",
        variables: ["Sarah", "Dental Exam", "https://cal.com/slot"],
        freeFormText: "Hi Sarah, can you make it this Thursday?",
      });

      expect(payload.type).toBe("text");
      expect(payload.text?.body).toBe("Hi Sarah, can you make it this Thursday?");
    });
  });
});
