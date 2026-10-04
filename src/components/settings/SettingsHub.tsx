"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Bell,
  Terminal,
  Shield,
  CheckCircle,
  Play,
  Send,
  Lock,
  Zap,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { BillingSettings } from "./BillingSettings";
import { saveNotificationSettingsAction, NotificationPreferences } from "@/app/actions/settings";

export function SettingsHub() {
  const [activeTab, setActiveTab] = useState<"billing" | "alerts" | "webhooks" | "security">("billing");

  // Alerts State
  const [alerts, setAlerts] = useState<NotificationPreferences>({
    emailAlerts: true,
    smsAlerts: true,
    whatsAppAlerts: true,
    slackWebhookUrl: "",
    digestFrequency: "instant",
  });
  const [alertSaveMessage, setAlertSaveMessage] = useState<string | null>(null);

  // Webhook Simulator State
  const [simLeadName, setSimLeadName] = useState("Dr. Jason Miller");
  const [simEmail, setSimEmail] = useState("jason.miller@dentalconsult.org");
  const [simPhone, setSimPhone] = useState("+15559876543");
  const [simService, setSimService] = useState("Dental Implants");
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const handleSaveAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveNotificationSettingsAction("org_demo", alerts);
    setAlertSaveMessage(res.message);
    setTimeout(() => setAlertSaveMessage(null), 3000);
  };

  const handleTestInboundWebhook = async () => {
    setSimLoading(true);
    setSimStatus(null);
    try {
      const res = await fetch("/api/webhooks/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: "org_demo",
          source: "form",
          lead: {
            name: simLeadName,
            email: simEmail,
            phone: simPhone,
            message: `Hi, interested in ${simService}. What is the earliest appointment?`,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimStatus(`HTTP 201 Created — Lead "${simLeadName}" enrolled into cadence (ID: ${data.lead_id})`);
      } else {
        setSimStatus(`HTTP ${res.status} — ${data.error || "Failed to trigger webhook"}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSimStatus(`Simulation Error: ${msg}`);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4 overflow-x-auto pb-px" aria-label="Settings Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("billing")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === "billing"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Subscription & Billing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === "alerts"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Mobile & Channel Alerts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === "webhooks"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Webhook Simulator & API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === "security"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>KMS & Security</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Billing & Tiers (Contains the required Starter/Growth/Scale & FIPS badge) */}
      {activeTab === "billing" && <BillingSettings />}

      {/* Tab 2: Mobile & Channel Alerts */}
      {activeTab === "alerts" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-slate-900">Mobile & Channel Alerts</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure how your clinical or sales team is alerted when prospective clients reply or request immediate attention.
            </p>
          </div>

          {alertSaveMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>{alertSaveMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveAlerts} className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-slate-800">Email Notifications</p>
                <p className="text-[11px] text-slate-500">Receive instant email digests when a lead transitions to &apos;Replied&apos;</p>
              </div>
              <input
                type="checkbox"
                checked={alerts.emailAlerts}
                onChange={(e) => setAlerts((p) => ({ ...p, emailAlerts: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-slate-300 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-slate-800">SMS / Text Alerts</p>
                <p className="text-[11px] text-slate-500">Send an emergency SMS to the on-duty coordinator for high-urgency leads</p>
              </div>
              <input
                type="checkbox"
                checked={alerts.smsAlerts}
                onChange={(e) => setAlerts((p) => ({ ...p, smsAlerts: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-slate-300 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-slate-800">WhatsApp Notification</p>
                <p className="text-[11px] text-slate-500">Push real-time alert to staff WhatsApp number via Meta Cloud API</p>
              </div>
              <input
                type="checkbox"
                checked={alerts.whatsAppAlerts}
                onChange={(e) => setAlerts((p) => ({ ...p, whatsAppAlerts: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded border-slate-300 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Slack Incoming Webhook URL (Optional)
              </label>
              <input
                type="url"
                value={alerts.slackWebhookUrl || ""}
                onChange={(e) => setAlerts((p) => ({ ...p, slackWebhookUrl: e.target.value }))}
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Save Notification Preferences
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Webhook Simulator & API */}
      {activeTab === "webhooks" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-slate-900">Inbound Webhook Simulator</h3>
            <p className="text-xs text-slate-500 mt-1">
              Simulate leads arriving from WordPress, Webflow, Typeform, or custom CRM forms directly into your active follow-up cadence.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prospect Name</label>
                <input
                  type="text"
                  value={simLeadName}
                  onChange={(e) => setSimLeadName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Inquired</label>
                <input
                  type="text"
                  value={simService}
                  onChange={(e) => setSimService(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestInboundWebhook}
                disabled={simLoading}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-70"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{simLoading ? "Simulating Webhook Intake..." : "Simulate Inbound Webhook Call"}</span>
              </button>
            </div>

            {simStatus && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800">
                {simStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: KMS & Security */}
      {activeTab === "security" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cryptographic Key Management</h3>
              <p className="text-xs text-slate-500">NIST SP 800-57 Envelope Encryption & FIPS 140-3 HSM</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Master KMS Key Status</p>
                <p className="text-[11px] text-slate-500">AWS KMS Hardware Security Module (FIPS 140-3 Level 3)</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
                Active & Healthy
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Data Encryption Key (DEK) Algorithm</p>
                <p className="text-[11px] text-slate-500">AES-256-GCM authenticated symmetric envelope</p>
              </div>
              <span className="font-mono text-slate-700 font-semibold">AES_256_GCM</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Automated Key Rotation</p>
                <p className="text-[11px] text-slate-500">Annual rotation enabled by default</p>
              </div>
              <span className="text-slate-600 font-medium">365-day schedule</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
