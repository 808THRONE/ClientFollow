import { z } from "zod";

export const IndustryEnum = z.enum([
  "dentist",
  "agency",
  "photographer",
  "lawyer",
  "home_services",
  "other",
]);

export const PlanTierEnum = z.enum(["starter", "growth", "pro"]);

export const SubscriptionStatusEnum = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
]);

export const OrganizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Organization name is required"),
  industry: IndustryEnum.optional(),
  plan_tier: PlanTierEnum.default("starter"),
  active_leads_limit: z.number().int().positive().default(30),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  subscription_status: SubscriptionStatusEnum.default("trialing"),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const OrganizationMemberRoleEnum = z.enum(["admin", "operator"]);

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: OrganizationMemberRoleEnum.default("operator"),
  invited_at: z.date().optional(),
  created_at: z.date().optional(),
});

export const ChannelTypeEnum = z.enum(["gmail", "whatsapp"]);
export const ChannelStatusEnum = z.enum(["active", "disconnected", "expired", "error"]);

export const ChannelIntegrationSchema = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid(),
  channel_type: ChannelTypeEnum,
  account_identifier: z.string().min(1),
  encrypted_access_token: z.instanceof(Buffer).optional(),
  encrypted_refresh_token: z.instanceof(Buffer).optional(),
  token_iv: z.instanceof(Buffer).optional(),
  token_auth_tag: z.instanceof(Buffer).optional(),
  kms_key_id: z.string().optional(),
  status: ChannelStatusEnum.default("active"),
  last_synced_at: z.date().nullable().optional(),
  expires_at: z.date().nullable().optional(),
});

export const LeadSourceEnum = z.enum(["gmail", "whatsapp", "webhook", "manual"]);
export const LeadStatusEnum = z.enum([
  "new_lead",
  "contacted",
  "replied",
  "booked",
  "lost",
  "queued_over_quota",
]);
export const UrgencyEnum = z.enum(["low", "medium", "high"]);
export const SentimentEnum = z.enum(["neutral", "positive", "objection", "unsubscribed"]);

export const LeadSchema = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid(),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: LeadSourceEnum,
  status: LeadStatusEnum.default("new_lead"),
  detected_service: z.string().nullable().optional(),
  detected_urgency: UrgencyEnum.default("medium"),
  sentiment: SentimentEnum.default("neutral"),
  requires_approval: z.boolean().default(false),
  approval_pending: z.boolean().default(false),
  external_thread_id: z.string().nullable().optional(),
  last_interaction_at: z.date().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const PlaybookStepSchema = z.object({
  step_number: z.number().int().positive(),
  delay_hours: z.number().min(0),
  channel: z.enum(["gmail", "whatsapp", "sms"]),
  template_name: z.string(),
  prompt_override: z.string().optional(),
});

export const SequencePlaybookSchema = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid(),
  name: z.string().min(1),
  industry: IndustryEnum,
  is_active: z.boolean().default(true),
  steps: z.array(PlaybookStepSchema).default([]),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});
