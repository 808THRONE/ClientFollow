export type PipelineStatus =
  | "new_lead"
  | "contacted"
  | "replied"
  | "booked"
  | "lost"
  | "queued_over_quota";

const ALLOWED_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  new_lead: ["contacted", "lost", "queued_over_quota"],
  contacted: ["replied", "booked", "lost"],
  replied: ["booked", "lost", "contacted"],
  booked: ["lost"], // Edge-case refund/cancel
  lost: ["new_lead", "contacted"], // Reactivation
  queued_over_quota: ["new_lead", "lost"],
};

export interface StageActionRules {
  requiresOutreach: boolean;
  requiresHumanTakeover: boolean;
  isTerminal: boolean;
}

/**
 * Validates if moving a lead from currentStatus to targetStatus is permitted.
 */
export function canTransitionStatus(
  currentStatus: PipelineStatus,
  targetStatus: PipelineStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
}

/**
 * Returns behavioral expectations and requirements for a given pipeline stage.
 */
export function getNextStageActions(status: PipelineStatus): StageActionRules {
  switch (status) {
    case "new_lead":
      return {
        requiresOutreach: true,
        requiresHumanTakeover: false,
        isTerminal: false,
      };
    case "contacted":
      return {
        requiresOutreach: false,
        requiresHumanTakeover: false,
        isTerminal: false,
      };
    case "replied":
      return {
        requiresOutreach: false,
        requiresHumanTakeover: true,
        isTerminal: false,
      };
    case "booked":
    case "lost":
      return {
        requiresOutreach: false,
        requiresHumanTakeover: false,
        isTerminal: true,
      };
    case "queued_over_quota":
      return {
        requiresOutreach: false,
        requiresHumanTakeover: false,
        isTerminal: false,
      };
  }
}
