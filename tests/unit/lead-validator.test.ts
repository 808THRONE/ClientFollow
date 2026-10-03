import { describe, it, expect } from "vitest";
import {
  OrganizationSchema,
  LeadSchema,
  ChannelIntegrationSchema,
  SequencePlaybookSchema,
} from "@/lib/db/validators";

describe("Database Entity Schema Validators (Zod)", () => {
  it("validates a compliant organization record", () => {
    const validOrg = {
      name: "Apex Dental Clinic",
      industry: "dentist",
      plan_tier: "growth",
      active_leads_limit: 100,
      subscription_status: "active",
    };

    const parsed = OrganizationSchema.safeParse(validOrg);
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid plan tier in organization", () => {
    const invalidOrg = {
      name: "Apex Dental",
      industry: "dentist",
      plan_tier: "ultra_vip_custom",
    };

    const parsed = OrganizationSchema.safeParse(invalidOrg);
    expect(parsed.success).toBe(false);
  });

  it("validates a compliant lead record", () => {
    const validLead = {
      org_id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Sarah Miller",
      email: "sarah.m@example.com",
      phone: "+15551234567",
      source: "gmail",
      status: "new_lead",
      detected_service: "Teeth Whitening",
      detected_urgency: "high",
      sentiment: "positive",
      requires_approval: false,
    };

    const parsed = LeadSchema.safeParse(validLead);
    expect(parsed.success).toBe(true);
  });

  it("validates sequence playbook steps structure", () => {
    const validPlaybook = {
      org_id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Standard Dentist Inactive Lead Recare",
      industry: "dentist",
      is_active: true,
      steps: [
        {
          step_number: 1,
          delay_hours: 24,
          channel: "gmail",
          template_name: "gentle_touch",
          prompt_override: "Tone: warm and gentle",
        },
        {
          step_number: 2,
          delay_hours: 48,
          channel: "whatsapp",
          template_name: "followup_gentle_reminder",
        },
      ],
    };

    const parsed = SequencePlaybookSchema.safeParse(validPlaybook);
    expect(parsed.success).toBe(true);
  });
});
