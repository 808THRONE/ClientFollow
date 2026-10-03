import { describe, it, expect } from "vitest";
import {
  canTransitionStatus,
  getNextStageActions,
  type PipelineStatus,
} from "@/lib/services/pipeline-state.service";

describe("Pipeline State Machine & Kanban Transitions", () => {
  it("allows valid forward transitions", () => {
    expect(canTransitionStatus("new_lead", "contacted")).toBe(true);
    expect(canTransitionStatus("contacted", "replied")).toBe(true);
    expect(canTransitionStatus("replied", "booked")).toBe(true);
    expect(canTransitionStatus("contacted", "lost")).toBe(true);
  });

  it("permits manual re-activation of lost leads back to new_lead", () => {
    expect(canTransitionStatus("lost", "new_lead")).toBe(true);
  });

  it("identifies correct next action triggers per stage", () => {
    const newLeadActions = getNextStageActions("new_lead");
    expect(newLeadActions.requiresOutreach).toBe(true);
    expect(newLeadActions.isTerminal).toBe(false);

    const bookedActions = getNextStageActions("booked");
    expect(bookedActions.isTerminal).toBe(true);
    expect(bookedActions.requiresOutreach).toBe(false);

    const repliedActions = getNextStageActions("replied");
    expect(repliedActions.requiresHumanTakeover).toBe(true);
  });
});
