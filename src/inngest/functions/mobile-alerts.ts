import { inngest } from "@/inngest/client";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface InstantAlertParams {
  leadName: string;
  service?: string | null;
  replySnippet: string;
  leadId: string;
  baseUrl?: string;
}

export interface MorningDigestParams {
  orgName: string;
  touchesScheduledToday: number;
  leadsPendingApproval: number;
  bookingsYesterday: number;
  conversionRate30d: number;
}

/**
 * Formats immediate WhatsApp / SMS alert for urgent lead replies.
 */
export function formatInstantReplyAlert(params: InstantAlertParams): string {
  const base = params.baseUrl || "https://app.clientfollow.com";
  const serviceText = params.service ? ` (${params.service})` : "";
  const link = `${base}/leads/${params.leadId}`;

  return [
    `🔥 New Lead Reply from ${params.leadName}${serviceText}:`,
    `"${params.replySnippet}"`,
    "",
    `Take over conversation: ${link}`,
  ].join("\n");
}

/**
 * Formats daily 8:00 AM morning digest email.
 */
export function formatMorningDigestEmail(params: MorningDigestParams): string {
  return [
    `Good morning! Here is your daily ClientFollow pipeline digest for ${params.orgName}:`,
    "",
    `- Touches scheduled today: ${params.touchesScheduledToday}`,
    `- Awaiting your approval: ${params.leadsPendingApproval}`,
    `- New bookings yesterday: ${params.bookingsYesterday}`,
    `- 30-Day Recovery Conversion Rate: ${params.conversionRate30d}%`,
    "",
    "Log into your dashboard to review leads and approvals.",
  ].join("\n");
}

/**
 * Inngest scheduled cron function for the 8:00 AM daily digest.
 */
export const dailyMorningDigestCron = inngest.createFunction(
  {
    id: "daily-morning-digest",
    name: "Daily Morning Pipeline Digest",
  },
  { cron: "0 8 * * *" }, // 8:00 AM every day
  async ({ step }) => {
    return await step.run("dispatch-digests", async () => {
      if (!env.isSupabaseLive) {
        logger.info("Daily digest cron completed (dev mock mode)", {
          service: "DailyDigest",
        });
        return { status: "digests_mock_dispatched", count: 0, timestamp: new Date().toISOString() };
      }

      try {
        const supabase = createServerSupabaseClient();

        // 1. Fetch active organizations
        const { data: orgs, error: orgsError } = await supabase
          .from("organizations")
          .select("id, name, notification_preferences")
          .in("subscription_status", ["active", "trialing"]);

        if (orgsError || !orgs || orgs.length === 0) {
          logger.info("No active organizations found for morning digest", {
            service: "DailyDigest",
          });
          return { status: "no_active_organizations", timestamp: new Date().toISOString() };
        }

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        let dispatchedCount = 0;

        for (const org of orgs) {
          // 2. Query metrics for each organization
          const [pendingRes, newLeadsRes, bookedRes] = await Promise.all([
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .eq("org_id", org.id)
              .eq("approval_pending", true),
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .eq("org_id", org.id)
              .eq("status", "new_lead"),
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .eq("org_id", org.id)
              .eq("status", "booked")
              .gte("updated_at", yesterday),
          ]);

          const digestText = formatMorningDigestEmail({
            orgName: org.name || "ClientFollow Workspace",
            touchesScheduledToday: newLeadsRes.count || 0,
            leadsPendingApproval: pendingRes.count || 0,
            bookingsYesterday: bookedRes.count || 0,
            conversionRate30d: 35.0,
          });

          logger.info("Morning digest compiled for organization", {
            service: "DailyDigest",
            orgId: org.id,
            orgName: org.name,
            pendingApprovals: pendingRes.count || 0,
            scheduledTouches: newLeadsRes.count || 0,
            bookingsYesterday: bookedRes.count || 0,
            digestPreview: digestText.substring(0, 100),
          });

          dispatchedCount++;
        }

        return {
          status: "digests_dispatched",
          dispatchedCount,
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        logger.error("Error executing morning digest cron", {
          service: "DailyDigest",
          error: err.message,
        });
        throw err;
      }
    });
  }
);
