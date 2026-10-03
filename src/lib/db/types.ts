import { z } from "zod";
import {
  OrganizationSchema,
  OrganizationMemberSchema,
  ChannelIntegrationSchema,
  LeadSchema,
  SequencePlaybookSchema,
  PlaybookStepSchema,
} from "./validators";

export type Organization = z.infer<typeof OrganizationSchema>;
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;
export type ChannelIntegration = z.infer<typeof ChannelIntegrationSchema>;
export type Lead = z.infer<typeof LeadSchema>;
export type SequencePlaybook = z.infer<typeof SequencePlaybookSchema>;
export type PlaybookStep = z.infer<typeof PlaybookStepSchema>;

export interface MessageRecord {
  id?: string;
  lead_id: string;
  org_id: string;
  direction: "inbound" | "outbound";
  channel: "gmail" | "whatsapp" | "sms";
  external_message_id?: string;
  content_snippet_encrypted: Buffer;
  snippet_iv: Buffer;
  snippet_auth_tag: Buffer;
  kms_key_id: string;
  sent_at?: Date;
}
