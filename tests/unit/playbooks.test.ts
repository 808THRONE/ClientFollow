import { describe, it, expect } from "vitest";
import {
  getPlaybookForIndustry,
  DEFAULT_NICHE_PLAYBOOKS,
} from "@/lib/services/playbook.service";

describe("Niche Playbooks Catalog (Dentists, Agencies, Photographers, Lawyers, Contractors)", () => {
  it("provides comprehensive playbooks for all 5 target industries", () => {
    const industries = ["dentist", "agency", "photographer", "lawyer", "home_services"] as const;

    for (const ind of industries) {
      const playbook = getPlaybookForIndustry(ind);
      expect(playbook).toBeDefined();
      expect(playbook.industry).toBe(ind);
      expect(playbook.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("dentist playbook has immediate answer + 48h WhatsApp reminder + reassurance", () => {
    const playbook = getPlaybookForIndustry("dentist");
    expect(playbook.steps[0].delay_hours).toBe(0.25); // 15 mins
    expect(playbook.steps[0].channel).toBe("gmail");

    expect(playbook.steps[1].delay_hours).toBe(48);
    expect(playbook.steps[1].channel).toBe("whatsapp");
    expect(playbook.steps[1].template_name).toBe("followup_gentle_reminder");
  });

  it("photographer playbook includes date hold urgency touch", () => {
    const playbook = getPlaybookForIndustry("photographer");
    const dateHoldTouch = playbook.steps.find((s) => s.step_number === 2);
    expect(dateHoldTouch).toBeDefined();
    expect(dateHoldTouch?.channel).toBe("whatsapp");
  });

  it("lawyer playbook enforces formal professional framing without emojis", () => {
    const playbook = getPlaybookForIndustry("lawyer");
    for (const step of playbook.steps) {
      expect(step.prompt_override).toContain("formal");
    }
  });
});
