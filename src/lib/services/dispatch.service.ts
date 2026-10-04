/**
 * Outbound touch dispatch service.
 *
 * This is the single code path that actually sends follow-up messages.
 * It composes no copy (the caller supplies the approved or drafted body),
 * persists an encrypted outbound message record, and atomically advances
 * the lead to "contacted" — only when the send genuinely succeeds.
 */
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { CryptoService } from "./crypto.service";
import { sendGmailMessage } from "./gmail.service";
import { ChannelDispatcherService } from "./channel-dispatcher.service";

export interface DispatchOutcome {
  delivered: boolean;
  simulated?: boolean;
  channel: string;
  messageId?: string;
  threadId?: string;
  reason?: string;
}

/**
 * Statuses that must never receive an outbound touch.
 */
const ABORT_STATUSES = ["replied", "booked", "lost", "queued_over_quota"];

/**
 * Pure guard: whether a lead in the given status should not be contacted.
 */
export function shouldAbortDispatch(leadStatus: string | null | undefined): boolean {
  return !!leadStatus && ABORT_STATUSES.includes(leadStatus);
}

/**
 * Maps an aborting lead status to the truthful follow_up_runs cancellation status.
 */
export function runCancellationStatus(leadStatus: string): string {
  if (leadStatus === "replied") return "cancelled_by_reply";
  if (leadStatus === "booked") return "cancelled_by_booking";
  return "cancelled";
}

interface LeadDispatchRow {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  detected_service: string | null;
  external_thread_id: string | null;
  last_interaction_at: string | null;
}

/**
 * Resolves the decrypted Gmail access token for an organization, if one is stored.
 */
async function getOrgGmailAccessToken(orgId: string): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("channel_integrations")
    .select("encrypted_access_token, token_iv, token_auth_tag, kms_key_id")
    .eq("org_id", orgId)
    .eq("channel_type", "gmail")
    .eq("status", "active")
    .limit(1);

  if (error) {
    throw new Error(`Failed to load channel integrations: ${error.message}`);
  }

  const row = data?.[0];
  if (!row?.encrypted_access_token) {
    return null;
  }

  if (!env.isKmsLive) {
    logger.warn("Gmail token stored but KMS is not live; cannot decrypt for dispatch", {
      service: "DispatchService",
      orgId,
    });
    return null;
  }

  try {
    const cryptoService = new CryptoService();
    const token = await cryptoService.decrypt(
      {
        encryptedData: row.encrypted_access_token as Buffer,
        // NOTE: channel_integrations currently stores a single ciphertext blob
        // without the separate encrypted DEK envelope. Until the OAuth callback
        // persists the full CryptoService envelope, any stored token will fail
        // to decrypt and dispatch must fail closed with a clear error.
        encryptedKey: (row as unknown as Record<string, unknown>).encrypted_key as Buffer,
        iv: (row.token_iv as Buffer) || Buffer.alloc(0),
        authTag: (row.token_auth_tag as Buffer) || Buffer.alloc(0),
        kmsKeyId: row.kms_key_id || env.KMS_MASTER_KEY_ID,
      },
      orgId
    );
    return token || null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("Gmail access token could not be decrypted; dispatch fails closed", {
      service: "DispatchService",
      orgId,
      error: msg,
    });
    return null;
  }
}

/**
 * Persists the outbound message record with an encrypted content snippet.
 * Skips (with a warning) when KMS is not live rather than storing plaintext.
 */
async function persistOutboundMessage(params: {
  orgId: string;
  leadId: string;
  channel: string;
  snippet: string;
  externalMessageId?: string;
}): Promise<void> {
  if (!env.isKmsLive) {
    logger.warn("Outbound message not persisted: KMS is not live (refusing to store plaintext)", {
      service: "DispatchService",
      leadId: params.leadId,
      orgId: params.orgId,
    });
    return;
  }

  try {
    const cryptoService = new CryptoService();
    const snippet = params.snippet.slice(0, 280);
    const encrypted = await cryptoService.encrypt(snippet, params.orgId);

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("messages").insert({
      lead_id: params.leadId,
      org_id: params.orgId,
      direction: "outbound",
      channel: params.channel,
      external_message_id: params.externalMessageId || null,
      content_snippet_encrypted: encrypted.encryptedData,
      snippet_iv: encrypted.iv,
      snippet_auth_tag: encrypted.authTag,
      kms_key_id: encrypted.kmsKeyId,
      sent_at: new Date().toISOString(),
    });

    if (error) {
      logger.error("Failed to persist outbound message record", {
        service: "DispatchService",
        leadId: params.leadId,
        orgId: params.orgId,
        error: error.message,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // The message was already sent — do not fail the step because of audit-persistence issues.
    logger.error("Outbound message persistence failed after successful send", {
      service: "DispatchService",
      leadId: params.leadId,
      orgId: params.orgId,
      error: msg,
    });
  }
}

/**
 * Dispatches one follow-up touch to a lead over the requested channel.
 *
 * - Refuses to send to leads in terminal/dormant statuses (replied, booked, lost, queued_over_quota).
 * - Persists an encrypted message record on success.
 * - Advances the lead to "contacted" with a status-guarded update so a concurrent
 *   "Mark Lost/Replied/Booked" can never be overwritten by a late dispatch.
 *
 * Throws on infrastructure failures so the Inngest step can retry; returns a
 * `delivered: false` outcome for deterministic data conditions (no contact info, etc.).
 */
export async function dispatchLeadTouch(params: {
  leadId: string;
  orgId: string;
  channel: "gmail" | "whatsapp" | "sms";
  messageBody: string;
  subject?: string;
  stepNumber?: number;
}): Promise<DispatchOutcome> {
  const { leadId, orgId, channel, messageBody, subject, stepNumber = 1 } = params;

  if (!env.isSupabaseLive) {
    return {
      delivered: false,
      simulated: true,
      channel,
      reason: "Supabase is not live; dispatch was simulated and no message was sent",
    };
  }

  const supabase = createServerSupabaseClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, status, email, phone, name, detected_service, external_thread_id, last_interaction_at")
    .eq("id", leadId)
    .eq("org_id", orgId)
    .single();

  if (leadErr) {
    if (leadErr.code === "PGRST116") {
      return { delivered: false, channel, reason: "Lead not found in this organization" };
    }
    throw new Error(`Failed to load lead for dispatch: ${leadErr.message}`);
  }

  const leadRow = lead as unknown as LeadDispatchRow;

  if (shouldAbortDispatch(leadRow.status)) {
    logger.info("Dispatch aborted: lead status prevents contact", {
      service: "DispatchService",
      leadId,
      status: leadRow.status,
    });
    return { delivered: false, channel, reason: `Lead status '${leadRow.status}' prevents dispatch` };
  }

  let messageId: string | undefined;
  let threadId: string | undefined;

  if (channel === "gmail") {
    if (!leadRow.email) {
      return { delivered: false, channel, reason: "Lead has no email address for gmail dispatch" };
    }

    const accessToken = await getOrgGmailAccessToken(orgId);
    if (!accessToken) {
      throw new Error(
        "No decryptable Gmail access token for this organization. Connect Gmail with live OAuth credentials in Settings to enable email dispatch."
      );
    }

    const sent = await sendGmailMessage(accessToken, {
      to: leadRow.email,
      subject: subject || "Following up on your inquiry",
      body: messageBody,
      threadId: leadRow.external_thread_id || undefined,
    });
    messageId = sent.messageId;
    threadId = sent.threadId;
  } else if (channel === "whatsapp") {
    if (!leadRow.phone) {
      return { delivered: false, channel, reason: "Lead has no phone number for whatsapp dispatch" };
    }
    if (!env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error(
        "WhatsApp Cloud API is not configured (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing). Cannot dispatch."
      );
    }

    const payload = ChannelDispatcherService.buildWhatsAppPayload({
      recipientPhone: leadRow.phone,
      lastInteractionAt: leadRow.last_interaction_at ? new Date(leadRow.last_interaction_at) : null,
      templateName: "clientfollow_followup",
      variables: [
        (leadRow.name || "there").split(" ")[0] || "there",
        leadRow.detected_service || "your inquiry",
      ],
      freeFormText: messageBody,
    });

    const sent = await ChannelDispatcherService.dispatchWhatsApp({
      apiToken: env.WHATSAPP_API_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      payload,
    });
    messageId = sent.messageId;
  } else {
    return { delivered: false, channel, reason: "sms channel is not supported in this release" };
  }

  await persistOutboundMessage({
    orgId,
    leadId,
    channel,
    snippet: messageBody,
    externalMessageId: messageId,
  });

  // Status-guarded advancement: only new_lead/contacted advance to contacted.
  const { data: updated, error: updateErr } = await supabase
    .from("leads")
    .update({
      status: "contacted",
      approval_pending: false,
      external_thread_id: threadId || leadRow.external_thread_id || null,
      last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("org_id", orgId)
    .in("status", ["new_lead", "contacted"])
    .select("id")
    .limit(1);

  if (updateErr) {
    throw new Error(`Message sent but failed to advance lead status: ${updateErr.message}`);
  }

  if (!updated || updated.length === 0) {
    logger.warn("Lead status changed between dispatch check and status update; message was sent, status not advanced", {
      service: "DispatchService",
      leadId,
      orgId,
      stepNumber,
    });
  }

  logger.info("Follow-up touch dispatched", {
    service: "DispatchService",
    leadId,
    orgId,
    channel,
    stepNumber,
    messageId,
  });

  return { delivered: true, channel, messageId, threadId };
}
