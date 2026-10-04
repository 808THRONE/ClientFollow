"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { scanHistoricalThreads, calculateRecoveredPipelineValue, ScannedLeadResult } from "@/lib/services/scanner.service";
import { enrollScannedLeadsAction } from "@/app/actions/leads";

interface OnboardingWizardProps {
  onComplete?: () => void;
}

const INDUSTRIES = [
  {
    id: "dentist",
    title: "Dental Clinic",
    icon: "🦷",
    desc: "Recover chair cancellations & cosmetic inquiry quotes",
    benchmark: "$450 - $4,000 / lead",
  },
  {
    id: "agency",
    title: "Digital Agency",
    icon: "🚀",
    desc: "Close inbound discovery calls & proposal retainers",
    benchmark: "$3,000 - $10,000 / lead",
  },
  {
    id: "photographer",
    title: "Photographer",
    icon: "📷",
    desc: "Hold date urgency & follow up on wedding pricing packages",
    benchmark: "$1,800 - $4,500 / lead",
  },
  {
    id: "lawyer",
    title: "Law Firm / Attorney",
    icon: "⚖️",
    desc: "Attorney-client privilege intake & consultation bookings",
    benchmark: "$1,500 - $6,000 / lead",
  },
  {
    id: "home_services",
    title: "Contractor / Home Services",
    icon: "🔨",
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

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("dentist");
  const [channelConnected, setChannelConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedLeads, setScannedLeads] = useState<ScannedLeadResult[]>([]);
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

  const handleEnrollAndLaunch = async () => {
    setIsEnrolling(true);
    try {
      await enrollScannedLeadsAction("org_demo", selectedIndustry, scannedLeads);
    } catch (e: unknown) {
      console.warn("[OnboardingWizard] Enrollment notice:", e);
    } finally {
      if (onComplete) onComplete();
      router.push("/?enrolled=" + scannedLeads.length);
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
            {INDUSTRIES.map((ind) => (
              <div
                key={ind.id}
                onClick={() => setSelectedIndustry(ind.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedIndustry === ind.id
                    ? "border-blue-600 bg-blue-50/50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="text-2xl mb-2">{ind.icon}</div>
                <h3 className="font-bold text-gray-900 text-sm">{ind.title}</h3>
                <p className="text-xs text-gray-600 mt-0.5">{ind.desc}</p>
                <span className="inline-block mt-2 text-2xs font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                  Avg: {ind.benchmark}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
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

          <div className="space-y-4">
            <div className="p-5 bg-white border border-gray-200 rounded-xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
                  G
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Gmail (Google Workspace)</h4>
                  <p className="text-xs text-gray-500">Monitor inquiries & send threaded email follow-ups</p>
                </div>
              </div>
              <button
                onClick={() => setChannelConnected(true)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  channelConnected
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                }`}
              >
                {channelConnected ? "✓ Connected" : "Connect Gmail"}
              </button>
            </div>

            <div className="p-5 bg-white border border-gray-200 rounded-xl flex items-center justify-between opacity-80 shadow-2xs">
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
              className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs"
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
              Our AI evaluates your recent inbox to find unanswered quotes and inquiries you can recover right now.
            </p>
          </div>

          {scannedLeads.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center space-y-4">
              <div className="text-4xl">🔍</div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Uncover Lost Pipeline Revenue</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                  We&apos;ll inspect the last 7 days of incoming threads, filter out receipts and noise, and isolate leads needing follow-up.
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center shadow-xs">
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
                    className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-gray-900">{lead.sender}</span>
                        <span className="text-2xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
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
