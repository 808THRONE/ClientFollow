import { sendGmailMessage } from "./gmail.service";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const whatsappCircuitBreaker = new CircuitBreaker({
  name: "WhatsAppCloudAPI",
  failureThreshold: 3,
  recoveryTimeoutMs: 30_000,
  timeoutMs: 10_000,
});

export interface WhatsAppTemplateParameter {
  type: "text";
  text: string;
}

export interface WhatsAppTemplateComponent {
  type: "body" | "header";
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplatePayload {
  name: string;
  language: { code: string };
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppDispatchPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "template";
  text?: { body: string };
  template?: WhatsAppTemplatePayload;
}

export interface BuildWhatsAppPayloadParams {
  recipientPhone: string;
  lastInteractionAt: Date | null;
  templateName: string;
  languageCode?: string;
  variables: string[];
  freeFormText: string;
}

/**
 * Checks if the last inbound interaction from the lead occurred within Meta's 24-hour service window.
 */
export function isInside24HourWindow(lastInteractionAt: Date | null): boolean {
  if (!lastInteractionAt) return false;
  const now = Date.now();
  const interactionTime = new Date(lastInteractionAt).getTime();
  const diffHours = (now - interactionTime) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < 24;
}

import { substituteTemplateVariables } from "./template-substitute";
export { substituteTemplateVariables };

export class ChannelDispatcherService {
  /**
   * Constructs the appropriate Meta WhatsApp Cloud API payload respecting the 24-hour window.
   */
  static buildWhatsAppPayload(params: BuildWhatsAppPayloadParams): WhatsAppDispatchPayload {
    const isWithin24h = isInside24HourWindow(params.lastInteractionAt);

    if (isWithin24h) {
      return {
        messaging_product: "whatsapp",
        to: params.recipientPhone,
        type: "text",
        text: {
          body: params.freeFormText,
        },
      };
    }

    // Outside 24h: Must use pre-approved HSM template
    const parameters: WhatsAppTemplateParameter[] = params.variables.map((v) => ({
      type: "text",
      text: v,
    }));

    return {
      messaging_product: "whatsapp",
      to: params.recipientPhone,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          code: params.languageCode || "en_US",
        },
        components: [
          {
            type: "body",
            parameters,
          },
        ],
      },
    };
  }

  /**
   * Dispatches a live message via Meta's WhatsApp Cloud API (Graph v21.0).
   */
  static async dispatchWhatsApp(params: {
    apiToken: string;
    phoneNumberId: string;
    payload: WhatsAppDispatchPayload;
  }): Promise<{ messageId: string }> {
    if (!params.apiToken || !params.phoneNumberId) {
      throw new Error("apiToken and phoneNumberId are required for WhatsApp dispatch");
    }

    if (!isFeatureEnabled("whatsapp_integration")) {
      throw new Error("WhatsApp integration feature is currently disabled");
    }

    const executeCall = async () => {
      const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiToken}`,
        },
        body: JSON.stringify(params.payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp Cloud API dispatch failed (HTTP ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const messageId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
      return { messageId };
    };

    if (isFeatureEnabled("circuit_breaker_enabled")) {
      return whatsappCircuitBreaker.execute(executeCall);
    }
    return executeCall();
  }

  /**
   * Sends an email via Google Gmail REST API using the KMS-decrypted access token.
   */
  static async sendGmail(params: {
    accessToken: string;
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<{ messageId: string }> {
    return sendGmailMessage(params.accessToken, params);
  }
}
