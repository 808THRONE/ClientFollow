import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { followUpCadence, handleSequenceRejection } from "@/inngest/functions/follow-up-cadence";
import { dailyMorningDigestCron } from "@/inngest/functions/mobile-alerts";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [followUpCadence, dailyMorningDigestCron, handleSequenceRejection],
});
