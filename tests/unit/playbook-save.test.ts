import { describe, it, expect } from "vitest";
import { savePlaybookAction } from "@/app/actions/playbooks";

describe("Playbook Saving Server Action", () => {
  it("rejects empty steps array with informative message", async () => {
    const res = await savePlaybookAction({
      industry: "dentist",
      steps: [],
      autonomous: true,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing industry or steps");
  });

  it("successfully validates and saves customized steps", async () => {
    const res = await savePlaybookAction({
      industry: "agency",
      steps: [
        {
          step_number: 1,
          delay_hours: 12,
          channel: "gmail",
          template_name: "custom_audit",
          prompt_override: "Tone: direct and value-focused",
        },
      ],
      autonomous: false,
    });

    expect(res.success).toBe(true);
    expect(res.savedSteps).toHaveLength(1);
    expect(res.message).toContain("Successfully saved");
  });
});
