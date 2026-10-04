"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Clock,
  Mail,
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Save,
  Check,
} from "lucide-react";
import {
  DEFAULT_NICHE_PLAYBOOKS,
  NichePlaybookTemplate,
} from "@/lib/services/playbook.service";
import { savePlaybookAction } from "@/app/actions/playbooks";
import { PlaybookStep } from "@/lib/db/types";

const NICHE_TABS = [
  { id: "dentist", label: "Dentists & Clinics", subtitle: "Recare & Consults" },
  { id: "agency", label: "Digital Agencies", subtitle: "Retainers & Proposals" },
  { id: "photographer", label: "Photographers", subtitle: "Date Hold & Weddings" },
  { id: "lawyer", label: "Lawyers & Legal", subtitle: "Consultation & Intake" },
  { id: "home_services", label: "Contractors", subtitle: "Quote Acceptance" },
];

export function PlaybookManager() {
  const [activeTab, setActiveTab] = useState<string>("dentist");
  const [playbooks, setPlaybooks] = useState<Record<string, NichePlaybookTemplate>>(
    JSON.parse(JSON.stringify(DEFAULT_NICHE_PLAYBOOKS))
  );
  const [autonomousMode, setAutonomousMode] = useState<Record<string, boolean>>({
    dentist: true,
    agency: true,
    photographer: true,
    lawyer: false, // Default to approval for legal
    home_services: true,
  });

  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const playbook: NichePlaybookTemplate =
    playbooks[activeTab] || DEFAULT_NICHE_PLAYBOOKS.dentist;

  const formatDelay = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${hours} hours`;
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"}`;
  };

  const handleUpdateStepDirective = (stepIdx: number, newDirective: string) => {
    setPlaybooks((prev) => {
      const current = prev[activeTab];
      const updatedSteps = [...current.steps];
      updatedSteps[stepIdx] = {
        ...updatedSteps[stepIdx],
        prompt_override: newDirective,
      };
      return {
        ...prev,
        [activeTab]: {
          ...current,
          steps: updatedSteps,
        },
      };
    });
  };

  const handleUpdateStepDelay = (stepIdx: number, newDelayHours: number) => {
    setPlaybooks((prev) => {
      const current = prev[activeTab];
      const updatedSteps = [...current.steps];
      updatedSteps[stepIdx] = {
        ...updatedSteps[stepIdx],
        delay_hours: newDelayHours,
      };
      return {
        ...prev,
        [activeTab]: {
          ...current,
          steps: updatedSteps,
        },
      };
    });
  };

  const handleAddStep = () => {
    setPlaybooks((prev) => {
      const current = prev[activeTab];
      const nextStepNum = current.steps.length + 1;
      const lastDelay = current.steps[current.steps.length - 1]?.delay_hours || 48;
      const newStep: PlaybookStep = {
        step_number: nextStepNum,
        delay_hours: lastDelay + 72,
        channel: "gmail",
        template_name: "custom_followup_touch",
        prompt_override: "Tone: polite check-in, summarize key benefits and offer easy meeting link",
      };
      return {
        ...prev,
        [activeTab]: {
          ...current,
          steps: [...current.steps, newStep],
        },
      };
    });
  };

  const handleRemoveStep = (stepIdx: number) => {
    setPlaybooks((prev) => {
      const current = prev[activeTab];
      if (current.steps.length <= 1) return prev; // Keep at least one
      const updatedSteps = current.steps
        .filter((_, idx) => idx !== stepIdx)
        .map((step, idx) => ({ ...step, step_number: idx + 1 }));
      return {
        ...prev,
        [activeTab]: {
          ...current,
          steps: updatedSteps,
        },
      };
    });
  };

  const handleSavePlaybook = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await savePlaybookAction({
        industry: activeTab,
        steps: playbook.steps,
        autonomous: autonomousMode[activeTab],
      });
      if (res.success) {
        setSaveStatus(res.message);
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch {
      setSaveStatus("Failed to save playbook");
    } finally {
      setIsSaving(false);
    }
  };

  const getSampleMessage = (industry: string, stepNumber: number) => {
    switch (industry) {
      case "dentist":
        if (stepNumber === 1)
          return "Hi Sarah, Dr. Vance's office following up on your dental inquiry. We have 2 consultation openings this Thursday at 2:00 PM and 4:30 PM. Would either work for you?";
        if (stepNumber === 2)
          return "Hi Sarah, quick check-in from Apex Smiles! Just wanted to make sure you got our note about your dental consultation. Book directly here: https://apex.care/book";
        return "Hi Sarah, Dr. Vance wanted to check in one last time. We offer gentle sedation options and flexible 0% interest dental payment plans if that helps. Let us know anytime!";
      case "agency":
        if (stepNumber === 1)
          return "Hi Marcus, following up on the Q4 marketing proposal we discussed. Based on our benchmark analysis, similar brands saw a 2.4x return within 60 days. When's good for a 15-min walk-through?";
        if (stepNumber === 2)
          return "Hey Marcus, attaching our recent case study on SaaS retention. Thought this would be directly applicable to your team's upcoming targets!";
        return "Hi Marcus, haven't heard back so I assume priorities may have shifted. I'll close our file for now, but feel free to reach back out whenever you're ready to accelerate.";
      case "photographer":
        if (stepNumber === 1)
          return "Hi Chloe! I'm so excited about your October wedding plans! Your date is currently open on my calendar. Here is our complete collection pricing guide to review.";
        if (stepNumber === 2)
          return "Hey Chloe, just a gentle heads-up: I received another inquiry for that same October weekend. Since you reached out first, I wanted to offer you first right of refusal before releasing the hold!";
        return "Hi Chloe, sharing a link to our latest full wedding gallery so you can see how an entire day unfolds from morning prep to sparkler exit!";
      case "lawyer":
        if (stepNumber === 1)
          return "Dear Mr. O'Connor: Thank you for contacting our office regarding your business formation inquiry. To evaluate your matter under attorney-client privilege, please reserve a confidential intake conference: https://law.firm/intake";
        if (stepNumber === 2)
          return "Dear Mr. O'Connor: Following up regarding your legal consultation. Please note that certain corporate filing deadlines may affect your entity's tax status for the current fiscal quarter.";
        return "Dear Mr. O'Connor: As we have not received confirmation to proceed, our office is formally closing this preliminary inquiry file. We remain available should your legal needs arise in the future.";
      default:
        if (stepNumber === 1)
          return "Hi Robert, just sent over your commercial roofing estimate! Did you receive the PDF okay?";
        if (stepNumber === 2)
          return "Hey Robert, checking in on the roofing proposal. We include a 10-year workmanship warranty on all materials. Would you like our foreman to drop by for a quick 10-minute site confirmation?";
        return "Hey Robert, our crew is currently scheduling jobs in your area next week. We can offer a 10% multi-project equipment discount if you lock in your dates before Friday!";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Industry Follow-Up Playbooks
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              5 Pre-Tuned Cadences
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Automated multi-step follow-ups tailored to your specific business model. All sequences halt immediately upon reply or calendar booking.
          </p>
        </div>

        {/* Global Autonomous vs Approval Toggle */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-800">
              {autonomousMode[activeTab] ? "Autonomous Mode" : "Approval Required"}
            </p>
            <p className="text-[11px] text-slate-500">
              {autonomousMode[activeTab]
                ? "Sends automatically on schedule"
                : "Queues for 1-click review"}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setAutonomousMode((prev) => ({
                ...prev,
                [activeTab]: !prev[activeTab],
              }))
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              autonomousMode[activeTab] ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autonomousMode[activeTab] ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Vertical Selection Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
        {NICHE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setEditingStepIndex(null);
              }}
              className={`flex flex-col text-left px-4 py-3 rounded-xl border text-sm transition-all duration-150 cursor-pointer min-w-[160px] ${
                isActive
                  ? "bg-blue-50/80 border-blue-500 text-blue-900 shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <span className="font-semibold text-slate-900">{tab.label}</span>
              <span className="text-xs text-slate-500 mt-0.5">{tab.subtitle}</span>
            </button>
          );
        })}
      </div>

      {/* Playbook Overview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">{playbook.name}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active cadence: {playbook.steps.length} sequential touches over 7–10 days.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleAddStep}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Touch</span>
            </button>

            <button
              type="button"
              onClick={handleSavePlaybook}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-70"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Cadence"}</span>
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Cadence Steps Timeline */}
        <div className="mt-6 space-y-6">
          {playbook.steps.map((step, idx) => {
            const isWhatsApp = step.channel === "whatsapp";
            const sampleMsg = getSampleMessage(activeTab, step.step_number);
            const isEditing = editingStepIndex === idx;

            return (
              <div
                key={step.step_number}
                className="relative flex flex-col md:flex-row gap-6 p-5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                {/* Step Indicator */}
                <div className="flex md:flex-col items-center md:items-start gap-3 md:w-44 flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                    {step.step_number}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {formatDelay(step.delay_hours)}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {idx === 0 ? "Initial follow-up" : `After Step ${step.step_number - 1}`}
                    </p>
                  </div>
                </div>

                {/* Step Body */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isWhatsApp ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <MessageSquare className="h-3 w-3" /> WhatsApp Cloud (24h / HSM)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          <Mail className="h-3 w-3" /> Gmail Channel
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        template: {step.template_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingStepIndex(isEditing ? null : idx)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                      >
                        {isEditing ? "Done Editing" : "Edit Directives"}
                      </button>
                      {playbook.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          title="Remove step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Directive & Delay Editor */}
                  {isEditing ? (
                    <div className="p-4 bg-white rounded-xl border border-blue-200 space-y-3 shadow-2xs">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          AI Prompt Tone & Directives
                        </label>
                        <input
                          type="text"
                          value={step.prompt_override || ""}
                          onChange={(e) => handleUpdateStepDirective(idx, e.target.value)}
                          placeholder="e.g. Tone: warm, mention flexible financing..."
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Delay Hours (Current: {step.delay_hours} hrs)
                        </label>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={step.delay_hours}
                          onChange={(e) => handleUpdateStepDelay(idx, parseFloat(e.target.value) || 1)}
                          className="w-24 text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 font-medium">
                      Directive: {step.prompt_override || "Standard tone"}
                    </p>
                  )}

                  {/* Sample Live Message Preview */}
                  <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Sparkles className="h-3 w-3 text-blue-500" /> AI Dynamic Generation Preview
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      &ldquo;{sampleMsg}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
