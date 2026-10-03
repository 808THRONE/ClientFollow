"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Check,
  ShieldCheck,
  Mail,
  MessageSquare,
  Calendar,
  Lock,
  RefreshCw,
  ExternalLink,
  Zap,
} from "lucide-react";
import { DEMO_ORGANIZATION } from "@/lib/demo-data";
import { TIER_CONFIGS } from "@/lib/services/usage.service";

export function BillingSettings() {
  const [currentTier, setCurrentTier] = useState<string>("growth");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSelectTier = async (tier: string) => {
    setCheckoutLoading(tier);
    setFeedback(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: DEMO_ORGANIZATION.id,
          planTier: tier,
          customerEmail: "owner@apexsmiles.com",
        }),
      });

      const data = await res.json();
      if (data.url) {
        setFeedback(`Redirecting to Stripe Checkout for ${tier.toUpperCase()} plan...`);
        // In full browser flow: window.location.href = data.url;
        setCurrentTier(tier);
      } else {
        setFeedback("Subscription updated successfully!");
        setCurrentTier(tier);
      }
    } catch {
      setFeedback("Failed to initiate checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: TIER_CONFIGS.starter.monthlyPrice,
      leads: TIER_CONFIGS.starter.activeLeadsLimit,
      description: "Ideal for solo practitioners and boutique studios.",
      features: [
        "Up to 30 active leads / month",
        "1 Connected Channel (Gmail)",
        "Autonomous Reply Detection",
        "Standard Cadences (3 touches)",
        "NIST Envelope Encryption",
      ],
    },
    {
      id: "growth",
      name: "Growth",
      price: TIER_CONFIGS.growth.monthlyPrice,
      leads: TIER_CONFIGS.growth.activeLeadsLimit,
      description: "Best for growing dental clinics, agencies, and law offices.",
      features: [
        "Up to 100 active leads / month",
        "Dual Channels (Gmail + WhatsApp)",
        "Meta 24h Care Window & HSM Fallback",
        "Google Calendar Auto-Booking Sync",
        "Mobile SMS / WhatsApp Reply Alerts",
        "Require-Approval Queue Mode",
      ],
      popular: true,
    },
    {
      id: "pro",
      name: "Scale",
      price: TIER_CONFIGS.pro.monthlyPrice,
      leads: TIER_CONFIGS.pro.activeLeadsLimit,
      description: "For high-volume multi-location businesses and large teams.",
      features: [
        "Up to 300 active leads / month",
        "Unlimited Connected Mailboxes & Numbers",
        "Custom Cadence Duration & Steps",
        "Dedicated Webhook Ingestion API",
        "Priority Inngest Workflow Queue",
        "Annual FIPS 140-3 HSM Key Rotation",
      ],
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings & Billing
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your subscription plan, connected communication channels, and security settings.
        </p>

        {feedback && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Subscription Plans */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Subscription & Active Lead Volume
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Plans are soft-capped based on active enrolled leads per month. No unexpected hard cutoffs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {plans.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const isLoading = checkoutLoading === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                  plan.popular
                    ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm tracking-wide uppercase">
                    Most Popular
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          Current Plan
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      ${plan.price}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">/ month</span>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs font-semibold text-slate-700 flex items-center justify-between border border-slate-200/70">
                    <span>Active Leads Soft-Cap:</span>
                    <span className="text-blue-600">{plan.leads} leads / mo</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 pt-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    disabled={isCurrent || isLoading}
                    onClick={() => handleSelectTier(plan.id)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        : plan.popular
                        ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Active Subscription"
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        Upgrade to {plan.name}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Connected Channels Management */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Connected Channels</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Communication channels used to detect incoming inquiries and send automated follow-ups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Gmail OAuth</h4>
                  <p className="text-[11px] text-slate-500">Google Cloud Pub/Sub</p>
                </div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-slate-600">
              Connected as <strong className="text-slate-800">apex.clinic@gmail.com</strong>
            </p>
            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-emerald-700 font-medium">Watch Active</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                Reconnect
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">WhatsApp Cloud</h4>
                  <p className="text-[11px] text-slate-500">Meta Business API</p>
                </div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-slate-600">
              Connected to <strong className="text-slate-800">+1 (555) 019-2831</strong>
            </p>
            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-emerald-700 font-medium">24h Care Window Enabled</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                Manage HSM
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Calendar Sync</h4>
                  <p className="text-[11px] text-slate-500">Google Calendar / Calendly</p>
                </div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-slate-600">
              Auto-transition to <strong className="text-slate-800">Booked</strong> on meeting
            </p>
            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-emerald-700 font-medium">Webhook Live</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Security & NIST KMS Architecture */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                NIST SP 800-57 KMS Envelope Encryption
              </h3>
              <p className="text-xs text-slate-500">
                FIPS 140-3 Level 3 Hardware Security Module (HSM) Key Management
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="rounded-xl bg-white p-4 border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Master KMS Key
            </span>
            <p className="font-mono text-slate-800 mt-1 truncate">
              arn:aws:kms:...:key/mrk-7c82b139
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Authenticated Data (AAD)
            </span>
            <p className="font-mono text-slate-800 mt-1 truncate">
              org_id:{DEMO_ORGANIZATION.id}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Data Retention Policy
            </span>
            <p className="text-slate-800 font-semibold mt-1">
              Zero Raw Email Persistence
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
