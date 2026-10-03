"use client";

import React, { useState } from "react";
import { X, Plus, Sparkles, User, Mail, Phone, Tag, Zap } from "lucide-react";
import { Lead } from "@/lib/db/types";

interface QuickLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLead: (lead: Lead) => void;
}

export function QuickLeadModal({ isOpen, onClose, onAddLead }: QuickLeadModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("Dental Consultation");
  const [channel, setChannel] = useState<"gmail" | "whatsapp">("gmail");
  const [urgency, setUrgency] = useState<"high" | "medium" | "low">("medium");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone) {
      setError("Please provide at least an email or phone number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const newLead: Lead = {
      id: `lead_${Date.now()}`,
      org_id: "org_demo",
      name: name.trim() || "Anonymous Lead",
      email: email.trim() || null,
      phone: phone.trim() || null,
      source: channel,
      status: "new_lead",
      detected_service: service,
      detected_urgency: urgency,
      sentiment: "positive",
      requires_approval: requiresApproval,
      approval_pending: requiresApproval,
      created_at: new Date(),
    };

    setTimeout(() => {
      onAddLead(newLead);
      setIsSubmitting(false);
      onClose();
      // Reset form
      setName("");
      setEmail("");
      setPhone("");
    }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add Inbound Lead</h2>
              <p className="text-xs text-slate-500">Manually enroll a prospective client into cadence</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lead / Client Name
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Amanda Vance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number (WhatsApp)
              </label>
              <input
                type="tel"
                placeholder="+15552345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Inquiry / Service
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Dental Implants Consult">Dental Implants Consult</option>
                <option value="Q4 Marketing Retainer">Marketing Retainer</option>
                <option value="Wedding Photography Session">Wedding Photography</option>
                <option value="Legal Consultation">Legal Consultation</option>
                <option value="Home Renovation Estimate">Home Renovation Estimate</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel("gmail")}
                  className={`py-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                    channel === "gmail"
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Gmail
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("whatsapp")}
                  className={`py-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                    channel === "whatsapp"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Urgency Level
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="high">High (4h follow-up)</option>
                <option value="medium">Medium (24h follow-up)</option>
                <option value="low">Low (48h follow-up)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Execution Mode
              </label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="requires-approval-toggle"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="requires-approval-toggle"
                  className="text-xs text-slate-600 font-medium cursor-pointer"
                >
                  Require manual approval
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Enrolling..." : "Enroll in Follow-Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
