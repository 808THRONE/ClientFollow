"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Edit3,
  Clock,
  Sparkles,
  Send,
  MessageSquare,
  Mail,
  User,
  AlertCircle,
} from "lucide-react";
import { Lead } from "@/lib/db/types";
import { approveLeadSequence, rejectLeadSequence } from "@/app/actions/approval";

interface ApprovalQueueProps {
  initialLeads: Lead[];
}

export function ApprovalQueue({ initialLeads }: ApprovalQueueProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const pendingLeads = leads.filter(
    (l) => l.requires_approval && l.status !== "lost"
  );

  const getDefaultMessage = (lead: Lead) => {
    return (
      (lead.id && editedMessages[lead.id]) ||
      `Hi ${lead.name || "there"}, following up regarding your inquiry for ${
        lead.detected_service || "our services"
      }. Would you like to schedule a quick consultation this week?`
    );
  };

  const handleApprove = async (leadId: string) => {
    setProcessingId(leadId);
    setActionFeedback(null);
    try {
      const message = editedMessages[leadId];
      const res = await approveLeadSequence({
        leadId,
        stepId: "step_1",
        editedMessage: message,
      });

      if (res.success) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, requires_approval: false, status: "contacted" } : l
          )
        );
        setActionFeedback("Lead sequence approved and message dispatched.");
        setEditingId(null);
      } else {
        setActionFeedback(`Error: ${res.error}`);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (leadId: string) => {
    setProcessingId(leadId);
    setActionFeedback(null);
    try {
      const res = await rejectLeadSequence({
        leadId,
        reason: "User rejected from approval queue",
      });

      if (res.success) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        setActionFeedback("Lead follow-up rejected and cadence cancelled.");
      } else {
        setActionFeedback(`Error: ${res.error}`);
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Manual Approval Queue
            </h1>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              {pendingLeads.length} Awaiting Review
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Review and personalize AI-crafted follow-ups before they are sent to prospective clients.
          </p>
        </div>

        {actionFeedback && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}
      </div>

      {pendingLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
            <CheckCircle className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Queue is all clear</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            No follow-ups require manual approval. All active cadences are running autonomously with reply-cancellation enabled.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {pendingLeads.map((lead) => {
            const isEditing = editingId === lead.id;
            const isProcessing = processingId === lead.id;
            const message = getDefaultMessage(lead);

            return (
              <div
                key={lead.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* Lead Details */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-xs">
                          {lead.name ? lead.name.charAt(0) : "L"}
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">
                          {lead.name || "Anonymous Lead"}
                        </h2>
                      </div>

                      {lead.phone && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
                          <MessageSquare className="h-3 w-3" /> WhatsApp
                        </span>
                      )}

                      {lead.email && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
                          <Mail className="h-3 w-3" /> Email
                        </span>
                      )}

                      {lead.detected_urgency === "high" && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                          <AlertCircle className="h-3 w-3" /> High Urgency
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap gap-4">
                      {lead.email && <span>Email: {lead.email}</span>}
                      {lead.phone && <span>Phone: {lead.phone}</span>}
                      <span>Service: <strong className="text-slate-700">{lead.detected_service || "General Inquiry"}</strong></span>
                    </div>

                    {/* AI Drafted Message Preview */}
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-semibold flex items-center gap-1.5 text-blue-600">
                          <Sparkles className="h-3.5 w-3.5" /> AI Drafted Follow-Up (Step 1)
                        </span>
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setEditingId(lead.id || null)}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium cursor-pointer transition-colors"
                          >
                            <Edit3 className="h-3 w-3" /> Edit draft
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={message}
                            onChange={(e) =>
                              setEditedMessages((prev) => ({
                                ...prev,
                                [lead.id || ""]: e.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full text-sm rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-white text-slate-900 border"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded cursor-pointer transition-colors"
                            >
                              Done Editing
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                          "{message}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex sm:flex-col justify-end gap-2.5 lg:w-44 pt-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => lead.id && handleApprove(lead.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      {isProcessing ? "Sending..." : "Approve & Send"}
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => lead.id && handleReject(lead.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject Cadence
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
