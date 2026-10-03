import { describe, it, expect } from "vitest";
import { DEFAULT_NICHE_PLAYBOOKS, getPlaybookForIndustry } from "@/lib/services/playbook.service";

describe("Playbook Manager UI & Niche Cadence Specs", () => {
  it("provides structured steps for all 5 target business verticals", () => {
    const verticals = ["dentist", "agency", "photographer", "lawyer", "home_services"];

    for (const v of verticals) {
      const playbook = getPlaybookForIndustry(v);
      expect(playbook.name).toBeDefined();
      expect(playbook.steps.length).toBeGreaterThanOrEqual(3);
      expect(playbook.steps[0].delay_hours).toBeDefined();
      expect(playbook.steps[0].channel).toBeDefined();
    }
  });

  it("ensures WhatsApp steps are included for high-touch local verticals", () => {
    const dentist = getPlaybookForIndustry("dentist");
    const photographer = getPlaybookForIndustry("photographer");
    const contractor = getPlaybookForIndustry("home_services");

    expect(dentist.steps.some((s) => s.channel === "whatsapp")).toBe(true);
    expect(photographer.steps.some((s) => s.channel === "whatsapp")).toBe(true);
    expect(contractor.steps.some((s) => s.channel === "whatsapp")).toBe(true);
  });

  it("formats human-readable delays for UI cards", () => {
    const formatDelay = (hours: number): string => {
      if (hours < 1) return `${Math.round(hours * 60)} minutes`;
      if (hours < 24) return `${hours} hours`;
      const days = Math.round(hours / 24);
      return `${days} ${days === 1 ? "day" : "days"}`;
    };

    expect(formatDelay(0.25)).toBe("15 minutes");
    expect(formatDelay(2)).toBe("2 hours");
    expect(formatDelay(24)).toBe("1 day");
    expect(formatDelay(48)).toBe("2 days");
    expect(formatDelay(120)).toBe("5 days");
  });
});
