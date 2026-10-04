import React from "react";
import { Mail, MessageSquare, Globe, ArrowRight, GripVertical } from "lucide-react";
import { Lead } from "@/lib/db/types";
import { formatLeadBadge } from "./kanban-utils";

interface LeadCardProps {
  lead: Lead;
  onSelectLead: (lead: Lead) => void;
  onApprove?: (leadId: string) => void;
  onMoveStage?: (leadId: string, newStatus: string) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onSelectLead, onApprove, onMoveStage }) => {
  const badge = formatLeadBadge(lead);

  const badgeColors = {
    default: "bg-blue-50 text-blue-700 border-blue-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    destructive: "bg-rose-50 text-rose-700 border-rose-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
  }[badge.variant];

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id || "");
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onSelectLead(lead)}
      className="p-3.5 mb-2.5 bg-white rounded-xl shadow-2xs border border-slate-200/90 hover:border-blue-400 hover:shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing relative group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
          <h4 className="font-semibold text-slate-900 text-xs leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
            {lead.name || "Unknown Prospect"}
          </h4>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 whitespace-nowrap ${badgeColors}`}>
          {badge.label}
        </span>
      </div>

      <div className="text-[11px] text-slate-500 mb-2.5 pl-4">
        <span className="text-slate-400 font-medium">Inquiry:</span>{" "}
        <span className="text-slate-700 font-medium">{lead.detected_service || "General Inquiry"}</span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 capitalize font-medium text-slate-600">
          {lead.source === "whatsapp" ? (
            <>
              <MessageSquare className="h-3 w-3 text-emerald-600" />
              <span>WhatsApp</span>
            </>
          ) : lead.source === "gmail" ? (
            <>
              <Mail className="h-3 w-3 text-blue-600" />
              <span>Gmail</span>
            </>
          ) : (
            <>
              <Globe className="h-3 w-3 text-slate-500" />
              <span>Webhook</span>
            </>
          )}
        </div>

        {lead.approval_pending && onApprove ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApprove(lead.id || "");
            }}
            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
          >
            Approve Draft
          </button>
        ) : (
          <span className="text-slate-400 group-hover:text-slate-600 flex items-center text-[10px]">
            Details <ArrowRight className="h-2.5 w-2.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>

      {onMoveStage && (
        <div className="flex md:hidden items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 font-medium">Stage:</span>
          <select
            value={lead.status}
            onChange={(e) => {
              e.stopPropagation();
              onMoveStage(lead.id || "", e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-semibold bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
            aria-label={`Change stage for ${lead.name || "lead"}`}
          >
            <option value="new_lead">New Lead</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="booked">Booked 🎉</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      )}
    </div>
  );
};
