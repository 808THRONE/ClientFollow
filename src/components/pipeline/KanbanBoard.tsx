import React, { useState } from "react";
import { Lead } from "@/lib/db/types";
import { groupLeadsByColumn, ColumnKey } from "./kanban-utils";
import { LeadCard } from "./LeadCard";
import { LeadDrawer } from "./LeadDrawer";

interface KanbanBoardProps {
  initialLeads: Lead[];
  onStatusChange?: (leadId: string, newStatus: string) => void;
  onApproveLead?: (leadId: string) => void;
  onDeleteLead?: (leadId: string) => void;
  onResendTouch?: (leadId: string) => void;
}

const COLUMNS: Array<{ key: ColumnKey; title: string; color: string; hoverBg: string }> = [
  { key: "new_lead", title: "New Leads", color: "border-blue-300 bg-blue-50/50", hoverBg: "bg-blue-100/70 border-blue-400" },
  { key: "contacted", title: "Contacted", color: "border-indigo-300 bg-indigo-50/50", hoverBg: "bg-indigo-100/70 border-indigo-400" },
  { key: "replied", title: "Replied (Takeover)", color: "border-amber-300 bg-amber-50/50", hoverBg: "bg-amber-100/70 border-amber-400" },
  { key: "booked", title: "Booked 🎉", color: "border-emerald-300 bg-emerald-50/50", hoverBg: "bg-emerald-100/70 border-emerald-400" },
  { key: "lost", title: "Lost / Closed", color: "border-gray-300 bg-gray-50/50", hoverBg: "bg-gray-100/70 border-gray-400" },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  initialLeads,
  onStatusChange,
  onApproveLead,
  onDeleteLead,
  onResendTouch,
}) => {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [draggingOverCol, setDraggingOverCol] = useState<ColumnKey | null>(null);

  // Sync with initialLeads updates from server/optimistic parent state
  React.useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const grouped = groupLeadsByColumn(leads);

  const handleMoveStage = (leadId: string, newStatus: string) => {
    const validStatus = newStatus as Lead["status"];
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: validStatus, approval_pending: false } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: validStatus, approval_pending: false } : null));
    }
    if (onStatusChange) onStatusChange(leadId, newStatus);
  };

  const handleApprove = (leadId: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, approval_pending: false, status: "contacted" } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, approval_pending: false, status: "contacted" } : null));
    }
    if (onApproveLead) onApproveLead(leadId);
  };

  const handleDelete = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setSelectedLead(null);
    if (onDeleteLead) onDeleteLead(leadId);
  };

  const handleResend = (leadId: string) => {
    if (onResendTouch) onResendTouch(leadId);
  };

  const handleDragOver = (e: React.DragEvent, colKey: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggingOverCol !== colKey) {
      setDraggingOverCol(colKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetCol: ColumnKey) => {
    e.preventDefault();
    setDraggingOverCol(null);
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId) return;

    handleMoveStage(leadId, targetCol);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* 5-Column Responsive Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1 items-start">
        {COLUMNS.map((col) => {
          const colLeads = grouped[col.key] || [];
          const isOver = draggingOverCol === col.key;

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`flex flex-col h-full rounded-xl border p-3 transition-colors duration-150 min-h-[360px] ${
                isOver ? col.hoverBg : col.color
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200/80">
                <span className="font-semibold text-xs text-gray-800 uppercase tracking-wider">
                  {col.title}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white font-bold text-gray-700 shadow-2xs">
                  {colLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {colLeads.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400 border-2 border-dashed border-gray-200/70 rounded-lg">
                    {isOver ? "Drop lead here" : "No leads in stage"}
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <LeadCard
                      key={lead.id || Math.random().toString()}
                      lead={lead}
                      onSelectLead={setSelectedLead}
                      onApprove={handleApprove}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-out detail & approval drawer */}
      <LeadDrawer
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onApprove={handleApprove}
        onMoveStage={handleMoveStage}
        onDelete={handleDelete}
        onResend={handleResend}
      />
    </div>
  );
};
