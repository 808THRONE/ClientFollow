import React, { useEffect, useState } from "react";
import {
  X,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Phone,
  Trash2,
  Send,
  MessageSquare,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Lead } from "@/lib/db/types";
import { generateDraftFollowUpMessage } from "@/lib/services/approval.service";
import { saveLeadNoteAction, getLeadActivityAction } from "@/app/actions/leads";

interface ActivityItem {
  label: string;
  detail: string;
  at: string;
  kind: "created" | "run" | "message";
}

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (leadId: string) => void;
  onMoveStage: (leadId: string, newStage: string) => void;
  onDelete?: (leadId: string) => void;
  onResend?: (leadId: string) => void;
  onReject?: (leadId: string) => void;
}

export const LeadDrawer: React.FC<LeadDrawerProps> = ({
  lead,
  isOpen,
  onClose,
  onApprove,
  onMoveStage,
  onDelete,
  onResend,
  onReject,
}) => {
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync persisted notes and real activity when the drawer target changes.
  useEffect(() => {
    if (!lead || !lead.id) return;
    setConfirmDelete(false);
    setNoteError(null);
    setNotes(lead.notes ? lead.notes.split("\n").filter(Boolean) : []);

    let cancelled = false;
    getLeadActivityAction(lead.id)
      .then((res) => {
        if (!cancelled && res.success) {
          setActivity(res.items);
        }
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead?.id || !newNote.trim()) return;

    const entry = `[${new Date().toLocaleTimeString()}] ${newNote.trim()}`;
    setNotes((prev) => [entry, ...prev]);
    setNewNote("");
    setNoteError(null);

    try {
      const res = await saveLeadNoteAction(lead.id, entry.replace(/^\[[^\]]+\]\s*/, ""));
      if (!res.success) {
        setNotes((prev) => prev.filter((n) => n !== entry));
        setNoteError(res.error || "Failed to save note");
      }
    } catch (err: unknown) {
      setNotes((prev) => prev.filter((n) => n !== entry));
      const msg = err instanceof Error ? err.message : String(err);
      setNoteError(`Failed to save note: ${msg}`);
    }
  };

  const handleResendClick = () => {
    setResendStatus("Follow-up queued for dispatch");
    if (onResend && lead.id) {
      onResend(lead.id);
    }
    setTimeout(() => setResendStatus(null), 3000);
  };

  const handleDeleteClick = () => {
    if (onDelete && lead.id) {
      onDelete(lead.id);
    }
    setConfirmDelete(false);
    onClose();
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
              <span className="text-slate-500 font-medium">Sentiment:</span>
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
                  Approve &amp; Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onReject && lead.id) onReject(lead.id);
                  }}
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
              onClick={() => setConfirmDelete(true)}
              className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs transition-colors cursor-pointer"
              title="Delete lead permanently"
              aria-label="Delete lead permanently"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {resendStatus && (
            <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-1.5" role="status">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>{resendStatus}</span>
            </div>
          )}

          {/* Delete confirmation (in-app, replaces native confirm) */}
          {confirmDelete && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-2" role="alertdialog" aria-label="Confirm deletion">
              <div className="flex items-center gap-1.5 text-rose-900 font-semibold text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <span>Delete lead permanently?</span>
              </div>
              <p className="text-xs text-rose-800">
                &ldquo;{lead.name}&rdquo; and its follow-up sequence will be removed. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Delete Permanently
                </button>
              </div>
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
                Mark Booked
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

          {/* Cadence Activity Timeline — hydrated from follow_up_runs/messages, no fabricated entries */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Cadence Activity Timeline</span>
            </h4>
            <div className="space-y-2 text-xs">
              {activity.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic p-2">No recorded activity yet.</p>
              ) : (
                activity.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                    <div
                      className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${
                        item.kind === "message" ? "bg-emerald-500" : item.kind === "run" ? "bg-indigo-500" : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operator Notes — persisted to the lead record */}
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
            {noteError && (
              <p className="text-[11px] text-rose-600 mb-1.5" role="alert">{noteError}</p>
            )}
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
