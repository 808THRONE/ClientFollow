"use server";

import { PlaybookStep } from "@/lib/db/types";
import { createServerSupabaseClient } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export interface SavePlaybookInput {
  orgId?: string;
  industry: string;
  steps: PlaybookStep[];
  autonomous: boolean;
}

/**
 * Server action to save customized industry playbook cadence.
 */
export async function savePlaybookAction(input: SavePlaybookInput): Promise<{
  success: boolean;
  message: string;
  savedSteps?: PlaybookStep[];
  error?: string;
}> {
  try {
    if (!input.industry || !Array.isArray(input.steps) || input.steps.length === 0) {
      return {
        success: false,
        message: "Invalid cadence: At least one sequence step is required.",
        error: "Missing industry or steps",
      };
    }

    if (env.isSupabaseLive) {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.from("sequence_playbooks").upsert(
        {
          org_id: input.orgId || "org_demo",
          name: `${input.industry} Cadence`,
          industry: input.industry,
          steps: input.steps,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,industry" }
      );

      if (error) {
        throw new Error(error.message);
      }
    } else {
      logger.info("Playbook saved (mock mode)", {
        service: "PlaybooksAction",
        industry: input.industry,
        stepCount: input.steps.length,
      });
    }

    return {
      success: true,
      message: `Successfully saved ${input.steps.length}-touch cadence for ${input.industry}!`,
      savedSteps: input.steps,
    };
  } catch (err: any) {
    logger.error("Failed to save playbook cadence", {
      service: "PlaybooksAction",
      industry: input.industry,
      error: err.message,
    });
    return {
      success: false,
      message: "Failed to save playbook cadence",
      error: err.message,
    };
  }
}
