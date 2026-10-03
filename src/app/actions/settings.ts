"use server";

import { createServerSupabaseClient } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export interface NotificationPreferences {
  emailAlerts: boolean;
  smsAlerts: boolean;
  whatsAppAlerts: boolean;
  slackWebhookUrl?: string;
  digestFrequency: "instant" | "daily" | "weekly";
}

/**
 * Server action to update notification settings for the organization.
 */
export async function saveNotificationSettingsAction(
  orgId: string,
  preferences: NotificationPreferences
): Promise<{ success: boolean; message: string }> {
  if (!orgId) {
    return { success: false, message: "orgId is required" };
  }

  try {
    if (env.isSupabaseLive) {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase
        .from("organizations")
        .update({ notification_preferences: preferences, updated_at: new Date().toISOString() })
        .eq("id", orgId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      logger.info("Notification preferences saved (mock mode)", { service: "Settings", orgId });
    }

    return {
      success: true,
      message: "Notification preferences updated successfully!",
    };
  } catch (err: any) {
    logger.error("Failed to save notification settings", {
      service: "Settings",
      orgId,
      error: err.message,
    });
    return {
      success: false,
      message: `Failed to save preferences: ${err.message}`,
    };
  }
}
