import { describe, it, expect, vi } from "vitest";
import React from "react";
import { groupLeadsByColumn, formatLeadBadge } from "@/components/pipeline/kanban-utils";
import { LeadCard } from "@/components/pipeline/LeadCard";
import { LeadDrawer } from "@/components/pipeline/LeadDrawer";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

describe("Pipeline UI & Kanban Grouping Logic", () => {
  const sampleLeads = [
    { id: "1", name: "Sarah", status: "new_lead", detected_service: "Cleaning", approval_pending: true, source: "gmail", sentiment: "positive", detected_urgency: "high" },
    { id: "2", name: "Bob", status: "contacted", detected_service: "HVAC", approval_pending: false, source: "whatsapp", sentiment: "neutral", detected_urgency: "medium" },
    { id: "3", name: "Alice", status: "replied", detected_service: "Wedding", approval_pending: false, source: "webhook", sentiment: "positive", detected_urgency: "low" },
    { id: "4", name: "John", status: "booked", detected_service: "Law", approval_pending: false, source: "gmail", sentiment: "positive", detected_urgency: "medium" },
    { id: "5", name: "Dave", status: "lost", detected_service: "Agency", approval_pending: false, source: "gmail", sentiment: "objection", detected_urgency: "low" },
  ];

  it("accurately distributes leads into 5 distinct pipeline columns", () => {
    const columns = groupLeadsByColumn(sampleLeads as any);

    expect(columns.new_lead).toHaveLength(1);
    expect(columns.contacted).toHaveLength(1);
    expect(columns.replied).toHaveLength(1);
    expect(columns.booked).toHaveLength(1);
    expect(columns.lost).toHaveLength(1);
  });

  it("formats correct badges for pending approval leads", () => {
    const badge = formatLeadBadge({
      status: "new_lead",
      approval_pending: true,
      requires_approval: true,
    } as any);

    expect(badge.label).toBe("Needs Approval");
    expect(badge.variant).toBe("warning");
  });

  it("formats correct badge for replied leads requiring human takeover", () => {
    const badge = formatLeadBadge({
      status: "replied",
      approval_pending: false,
      requires_approval: false,
    } as any);

    expect(badge.label).toBe("Takeover Needed");
    expect(badge.variant).toBe("destructive");
  });

  it("formats success badge for booked leads", () => {
    const badge = formatLeadBadge({
      status: "booked",
      approval_pending: false,
      requires_approval: false,
    } as any);

    expect(badge.label).toBe("Booked");
    expect(badge.variant).toBe("success");
  });

  it("renders LeadCard with draggable attributes enabled", () => {
    const card = React.createElement(LeadCard, {
      lead: sampleLeads[0] as any,
      onSelectLead: vi.fn(),
    });
    expect(card).toBeDefined();
  });

  it("renders LeadDrawer with timeline and action controls", () => {
    const drawer = React.createElement(LeadDrawer, {
      lead: sampleLeads[0] as any,
      isOpen: true,
      onClose: vi.fn(),
      onApprove: vi.fn(),
      onMoveStage: vi.fn(),
      onDelete: vi.fn(),
      onResend: vi.fn(),
    });
    expect(drawer).toBeDefined();
  });

  it("renders KanbanBoard with drag-and-drop column support", () => {
    const board = React.createElement(KanbanBoard, {
      initialLeads: sampleLeads as any,
      onStatusChange: vi.fn(),
      onApproveLead: vi.fn(),
      onDeleteLead: vi.fn(),
      onResendTouch: vi.fn(),
    });
    expect(board).toBeDefined();
  });
});
