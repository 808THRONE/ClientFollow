import { Inngest, EventSchemas } from "inngest";

// Define Event Schemas
export type ClientFollowEvents = {
  "app/inbound.message": {
    data: {
      channel: "gmail" | "whatsapp" | "webhook";
      sender: string;
      external_id: string;
      raw_snippet: string;
      metadata?: Record<string, any>;
    };
  };
  "app/lead.detected": {
    data: {
      lead_id: string;
      org_id: string;
      service?: string | null;
      requires_approval: boolean;
      playbook_steps?: Array<{
        step_number: number;
        delay_hours: number;
        channel: "gmail" | "whatsapp" | "sms";
        template_name: string;
        prompt_override?: string;
      }>;
    };
  };
  "app/sequence.approved": {
    data: {
      lead_id: string;
      approved_by?: string;
      step_number?: number;
      step_id?: string;
      approved_message?: string;
    };
  };
  "app/sequence.rejected": {
    data: {
      lead_id: string;
      step_id?: string;
      reason?: string;
    };
  };
  "app/lead.replied": {
    data: {
      lead_id: string;
      org_id?: string;
      channel: string;
      reply_snippet: string;
      sentiment: "neutral" | "positive" | "objection" | "unsubscribed";
    };
  };
  "app/lead.booked": {
    data: {
      lead_id: string;
      org_id: string;
      booking_time: string;
      calendar_source?: string;
    };
  };
  "app/gmail.history.received": {
    data: {
      emailAddress: string;
      historyId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "clientfollow",
  name: "ClientFollow Workflow Engine",
  schemas: new EventSchemas().fromRecord<ClientFollowEvents>(),
});
