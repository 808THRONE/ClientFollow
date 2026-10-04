import React, { useState } from "react";
import {
  X,
  CheckCircle,
  Calendar,
  AlertCircle,
  Sparkles,
  User,
  Mail,
  Phone,
  ArrowRight,
  Trash2,
  Send,
  MessageSquare,
  Clock,
  Plus,
} from "lucide-react";
import { Lead } from "@/lib/db/types";
import { generateDraftFollowUpMessage } from "@/lib/services/approval.service";

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (leadId: string) => void;
  onMoveStage: (leadId: string, newStage: string) => void;
  onDelete?: (leadId: string) => void;
  onResend?: (leadId: string) => void;
}

export const LeadDrawer: React.FC<LeadDrawerProps> = ({
  lead,
  isOpen,
  onClose,
  onApprove,
  onMoveStage,
  onDelete,
  onResend,
}) => {
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<string[]>([
    "Initial inbound inquiry detected via automated channel listener.",
  ]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  if (!isOpen || !lead) return null;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes((prev) => [`[${new Date().toLocaleTimeString()}] ${newNote.trim()}`, ...prev]);
    setNewNote("");
  };

  const handleResendClick = () => {
    setResendStatus("Follow-up dispatched to queue!");
    if (onResend && lead.id) {
      onResend(lead.id);
    }
    setTimeout(() => setResendStatus(null), 3000);
  };

  const handleDeleteClick = () => {
    if (confirm(`Are you sure you want to permanently delete lead "${lead.name}"?`)) {
      if (onDelete && lead.id) {
        onDelete(lead.id);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{lead.name || "Prospect Details"}</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {lead.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{lead.email || lead.phone || "No direct contact info"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lead Intelligence Details */}
        <div className="py-4 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Service Requested:</span>
              <span className="font-semibold text-slate-800">{lead.detected_service || "General Consultation"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Inbound Source:</span>
              <span className="font-semibold text-slate-800 capitalize flex items-center gap-1">
                {lead.source === "whatsapp" ? <MessageSquare className="h-3 w-3 text-emerald-600" /> : <Mail className="h-3 w-3 text-blue-600" />}
                {lead.source}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">AI Sentiment:</span>
              <span className="font-semibold text-slate-800 capitalize">{lead.sentiment}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Detected Urgency:</span>
              <span className={`font-semibold capitalize ${lead.detected_urgency === "high" ? "text-rose-600 font-bold" : "text-slate-800"}`}>
                {lead.detected_urgency}
              </span>
            </div>
          </div>

          {/* Pending Approval Action Card */}
          {lead.approval_pending && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>Follow-Up Draft Pending Approval</span>
              </div>
              <p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-amber-100 leading-relaxed font-sans">
                &ldquo;{generateDraftFollowUpMessage(lead)}&rdquo;
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(lead.id || "")}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Approve & Dispatch Now
                </button>
                <button
                  type="button"
                  onClick={() => onMoveStage(lead.id || "", "lost")}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Quick Dispatch / Resend */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResendClick}
              className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Resend Follow-Up Touch</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs transition-colors cursor-pointer"
              title="Delete lead permanently"
              aria-label="Delete lead permanently"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {resendStatus && (
            <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>{resendStatus}</span>
            </div>
          )}

          {/* Manual Stage Override Controls */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Move Pipeline Stage</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onMoveStage(lead.id || "", "contacted")}
                className="py-1.5 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-lg font-medium border border-slate-200 text-slate-700 text-center transition-colors cursor-pointer"
              >
                Mark Contacted
              </button>
              <button
                type="button"
                onClick={() => onMoveStage(lead.id || "", "replied")}
                className="py-1.5 px-2 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 rounded-lg font-medium border border-slate-200 text-slate-700 text-center transition-colors cursor-pointer"
              >
                Mark Replied
              </button>
              <button
                type="button"
                onClick={() => onMoveStage(lead.id || "", "booked")}
                className="py-1.5 px-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 rounded-lg font-medium border border-slate-200 text-slate-700 text-center transition-colors cursor-pointer"
              >
                Mark Booked 🎉
              </button>
              <button
                type="button"
                onClick={() => onMoveStage(lead.id || "", "lost")}
                className="py-1.5 px-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-lg font-medium border border-slate-200 text-slate-700 text-center transition-colors cursor-pointer"
              >
                Mark Lost
              </button>
            </div>
          </div>

          {/* Touch History / Activity Timeline */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Cadence Activity Timeline</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">Inbound Inquiry Logged</p>
                  <p className="text-[11px] text-slate-500">Service: {lead.detected_service} via {lead.source}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">Enrolled in Automated Cadence</p>
                  <p className="text-[11px] text-slate-500">3-Touch Niche Playbook active</p>
                </div>
              </div>
              {lead.status === "booked" && (
                <div className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="h-2 w-2 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-900">Meeting Booked on Calendar</p>
                    <p className="text-[11px] text-emerald-700">Follow-up sequence automatically halted</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Operator Notes */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Internal Notes</h4>
            <form onSubmit={handleAddNote} className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add private operator note..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Save Note
              </button>
            </form>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {notes.map((note, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 border border-slate-100">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
