"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Rocket,
  Camera,
  Scale,
  Wrench,
  Search,
  Sparkles,
  CheckCircle,
  Mail,
  AlertCircle,
} from "lucide-react";
import { scanHistoricalThreads, calculateRecoveredPipelineValue, ScannedLeadResult } from "@/lib/services/scanner.service";
import { enrollScannedLeadsAction } from "@/app/actions/leads";

interface OnboardingWizardProps {
  onComplete?: () => void;
  orgId?: string;
}

const INDUSTRIES = [
  {
    id: "dentist",
    title: "Dental Clinic",
    icon: Activity,
    iconColor: "text-blue-600 bg-blue-50",
    desc: "Recover chair cancellations & cosmetic inquiry quotes",
    benchmark: "$450 - $4,000 / lead",
  },
  {
    id: "agency",
    title: "Digital Agency",
    icon: Rocket,
    iconColor: "text-indigo-600 bg-indigo-50",
    desc: "Close inbound discovery calls & proposal retainers",
    benchmark: "$3,000 - $10,000 / lead",
  },
  {
    id: "photographer",
    title: "Photographer",
    icon: Camera,
    iconColor: "text-amber-600 bg-amber-50",
    desc: "Hold date urgency & follow up on wedding pricing packages",
    benchmark: "$1,800 - $4,500 / lead",
  },
  {
    id: "lawyer",
    title: "Law Firm / Attorney",
    icon: Scale,
    iconColor: "text-slate-700 bg-slate-100",
    desc: "Attorney-client privilege intake & consultation bookings",
    benchmark: "$1,500 - $6,000 / lead",
  },
  {
    id: "home_services",
    title: "Contractor / Home Services",
    icon: Wrench,
    iconColor: "text-orange-600 bg-orange-50",
    desc: "Follow up on HVAC, roofing, and remodeling estimates",
    benchmark: "$1,200 - $9,000 / lead",
  },
];

const SAMPLE_SCAN_MESSAGES = [
  {
    id: "demo_1",
    sender: "jessica.m@gmail.com",
    subject: "Inquiry about teeth whitening appointment",
    body: "Hi Dr. Smith, do you have any appointments available next week for professional teeth whitening?",
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "demo_2",
    sender: "noreply@uber.com",
    subject: "Your trip receipt with Uber",
    body: "Thanks for riding. Total: $24.50",
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "demo_3",
    sender: "robert.b@constructco.net",
    subject: "Looking for quote on full dental implants",
    body: "Hello, looking to get pricing and consultation details for full upper implants.",
    receivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "demo_4",
    sender: "newsletter@submittable.com",
    subject: "Weekly digest of creative opportunities",
    body: "Check out this week's top picks...",
    receivedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, orgId = "org_demo" }) => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("dentist");
  const [channelConnected, setChannelConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedLeads, setScannedLeads] = useState<ScannedLeadResult[]>([]);
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const handleEnrollAndLaunch = async () => {
    setIsEnrolling(true);
    setEnrollError(null);
    try {
      const res = await enrollScannedLeadsAction(orgId, selectedIndustry, scannedLeads);
      if (res.success) {
        if (onComplete) onComplete();
        router.push("/?enrolled=" + res.enrolledCount);
      } else {
        // Do NOT complete onboarding when enrollment failed (e.g. no live
        // channel integration) — the user needs to see why nothing was enrolled.
        setEnrollError(res.errors?.[0] || "Enrollment failed. Check your channel connections in Settings.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setEnrollError(`Enrollment failed: ${msg}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRunScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const results = scanHistoricalThreads({
        messages: SAMPLE_SCAN_MESSAGES,
        industry: selectedIndustry,
      });
      setScannedLeads(results);
      setIsScanning(false);
    }, 1200);
  };

  const totalValue = calculateRecoveredPipelineValue(scannedLeads);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            1
          </div>
          <span className="text-xs font-semibold text-gray-700">Pick Industry</span>
        </div>
        <div className="h-0.5 flex-1 bg-gray-200 mx-4" />
        <div className="flex items-center space-x-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            2
          </div>
          <span className="text-xs font-semibold text-gray-700">Connect Channel</span>
        </div>
        <div className="h-0.5 flex-1 bg-gray-200 mx-4" />
        <div className="flex items-center space-x-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            3
          </div>
          <span className="text-xs font-semibold text-gray-700">Scan & Recover</span>
        </div>
      </div>

      {/* STEP 1: PICK INDUSTRY */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Select Your Service Industry
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              We&apos;ll auto-configure your follow-up sequence with pre-tuned delays and copy templates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INDUSTRIES.map((ind) => {
              const IconComp = ind.icon;
              return (
                <div
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedIndustry === ind.id
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${ind.iconColor}`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{ind.title}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{ind.desc}</p>
                  <span className="inline-block mt-2 text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                    Avg: {ind.benchmark}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Continue to Channel Setup →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CONNECT CHANNELS */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Connect Your Lead Channels
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Connect where your inquiries arrive. We monitor for new leads and stop touches the moment they reply.
            </p>
          </div>

          {/* Sandbox Advisory Banner */}
          <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-950">Onboarding Sandbox:</span>{" "}
              <span>
                Clicking &ldquo;Connect Gmail&rdquo; simulates OAuth authorization for this interactive walkthrough. To connect live Google Workspace or Meta WhatsApp Cloud channels, configure them in your Settings tab.
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 bg-white border border-gray-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Gmail (Google Workspace)</h4>
                  <p className="text-xs text-gray-500">Monitor inquiries & send threaded email follow-ups</p>
                </div>
              </div>
              <button
                onClick={() => setChannelConnected(true)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  channelConnected
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                }`}
              >
                {channelConnected ? "✓ Connected" : "Connect Gmail"}
              </button>
            </div>

            <div className="p-5 bg-white border border-gray-200 rounded-xl flex items-center justify-between opacity-80 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  WA
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Meta WhatsApp Cloud API</h4>
                  <p className="text-xs text-gray-500">Send WhatsApp reminders with pre-approved HSM templates</p>
                </div>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Optional in V1
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium cursor-pointer"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm cursor-pointer"
            >
              Next: Scan Past 7 Days →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SCAN PAST 7 DAYS (INSTANT ROI) */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Scan Past 7 Days for Lost Revenue
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Our AI evaluates recent inquiries to find unanswered quotes and leads you can recover right now.
            </p>
          </div>

          {/* Simulation Notice Banner */}
          <div className="rounded-xl bg-blue-50/90 border border-blue-200 p-4 text-xs text-blue-900 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-950">Simulation Notice:</span>{" "}
              <span>
                The 7-Day Revenue Scanner demonstrates lead recovery using representative inquiries for {selectedIndustry}. Live inbox scans run via KMS-encrypted Google OAuth credentials with zero data shared outside your tenant.
              </span>
            </div>
          </div>

          {scannedLeads.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-2">
                <Search className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Uncover Lost Pipeline Revenue</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                  We&apos;ll inspect incoming threads, filter out receipts and noise, and isolate genuine leads needing follow-up.
                </p>
              </div>
              <button
                onClick={handleRunScanner}
                disabled={isScanning}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                {isScanning ? "Scanning Past 7 Days..." : "Run 7-Day Revenue Scanner"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Revenue Alert Counter */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
                <span className="text-xs uppercase font-bold text-emerald-700 tracking-wider">
                  Unrecovered Revenue Found
                </span>
                <div className="text-4xl font-extrabold text-emerald-900 my-1">
                  ${totalValue.toLocaleString()}
                </div>
                <p className="text-xs text-emerald-700">
                  Across {scannedLeads.length} genuine unanswered leads sitting in your inbox right now.
                </p>
              </div>

              {/* Scanned Lead List */}
              <div className="space-y-3">
                {scannedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-gray-900">{lead.sender}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                          {lead.detectedService}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 italic mt-1 max-w-lg truncate">
                        &ldquo;{lead.snippet}&rdquo;
                      </p>
                      <div className="text-xs font-semibold text-emerald-700 mt-1">
                        Est. Deal Value: ${lead.estimatedValue.toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      Ready to Recover
                    </span>
                  </div>
                ))}
              </div>

              {enrollError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 flex items-start gap-2.5" role="alert">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Enrollment blocked:</span>{" "}
                    <span>{enrollError}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleEnrollAndLaunch}
                  disabled={isEnrolling}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-75 cursor-pointer"
                >
                  {isEnrolling ? "Enrolling Leads into Cadence..." : "Enroll All Leads & Launch Dashboard →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
