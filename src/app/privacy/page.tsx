import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Zap, Lock, Database, EyeOff, Server } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | ClientFollow",
  description: "Privacy Policy detailing AI data processing, zero-model-training guarantees, sub-processors, and data rights.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-900 font-bold text-lg hover:opacity-90 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <span>ClientFollow</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/terms" className="text-slate-600 hover:text-slate-900 transition-colors">
              Terms of Service
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-xs font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacy &amp; Data Protection
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-xs text-slate-500">
              Last Updated: October 3, 2026 &bull; Compliant with GDPR, CCPA/CPRA &amp; NIST SP 800-57
            </p>
          </div>

          {/* Zero Model Training Guarantee Callout */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
            <EyeOff className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 space-y-1">
              <p className="font-bold text-sm text-emerald-900">Zero-Training Privacy Guarantee</p>
              <p>
                ClientFollow does <strong>not</strong> use customer proprietary data, conversation snippets, or lead information
                to train, re-train, or fine-tune public artificial intelligence models. All API integrations with AI vendors
                operate under strict zero-data-retention and zero-training enterprise terms.
              </p>
            </div>
          </div>

          {/* Section 1: Overview */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. Information We Collect
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We collect information necessary to operate autonomous revenue recovery workflows on your behalf:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>
                <strong>Account &amp; Billing Data:</strong> Name, business email, organization name, industry, and Stripe customer identification.
              </li>
              <li>
                <strong>Integration Tokens:</strong> OAuth credentials for connected channels (Gmail, Meta WhatsApp Business Cloud API).
                All tokens are encrypted immediately upon receipt using AWS KMS envelope encryption.
              </li>
              <li>
                <strong>Lead &amp; Communication Metadata:</strong> Prospect name, email, phone number, detected service category,
                urgency score, and message snippets required to execute follow-up cadences.
              </li>
            </ul>
          </section>

          {/* Section 2: AI Processing */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. How AI &amp; Machine Learning Processes Your Data
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              When an inbound message is received, ClientFollow passes minimal message text to an AI classifier to identify
              intent (e.g., inquiry, quote request, booking).
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>
                <strong>Transient Evaluation:</strong> Prompts sent to LLM APIs are evaluated transiently in memory to generate
                classifications and drafts.
              </li>
              <li>
                <strong>Local LLM Compatibility:</strong> Organizations with high sensitivity requirements may configure
                ClientFollow to run entirely against on-premise or local model endpoints (e.g. Ollama / vLLM), ensuring zero external data transmission.
              </li>
            </ul>
          </section>

          {/* Section 3: Sub-processors */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. Authorized Sub-Processors
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We rely on trusted third-party cloud infrastructure providers who meet stringent security standards:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-600 border border-slate-200 rounded-lg">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Sub-Processor</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Location &amp; Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">Supabase Inc.</td>
                    <td className="py-2 px-3">Multi-tenant PostgreSQL database &amp; Auth</td>
                    <td className="py-2 px-3">US / EU (SOC2 Type II, RLS Enforced)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">Amazon Web Services (AWS)</td>
                    <td className="py-2 px-3">KMS Envelope Key Management &amp; Cloud</td>
                    <td className="py-2 px-3">US-East (FIPS 140-3 Hardware Modules)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">Inngest Inc.</td>
                    <td className="py-2 px-3">Durable workflow queue and scheduling</td>
                    <td className="py-2 px-3">US (Encrypted event bus)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">Stripe Inc.</td>
                    <td className="py-2 px-3">Subscription billing &amp; payment processing</td>
                    <td className="py-2 px-3">Global (PCI-DSS Level 1)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">OpenAI, LLC</td>
                    <td className="py-2 px-3">Intent classification &amp; draft generation</td>
                    <td className="py-2 px-3">US (API Zero-Data-Retention Policy)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">Meta Platforms, Inc.</td>
                    <td className="py-2 px-3">WhatsApp Business Cloud messaging</td>
                    <td className="py-2 px-3">Global (End-to-end transport encryption)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Security */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. Security Architecture &amp; Tenant Isolation
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We implement defense-in-depth measures to protect your organization from unauthorized access:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>
                <strong>Row Level Security (RLS):</strong> Every database row is partitioned by tenant ID (`org_id`).
                Database queries cannot access other organizations&rsquo; leads or playbooks.
              </li>
              <li>
                <strong>Envelope Encryption:</strong> Secret tokens are encrypted with individual data keys (DEKs) wrapped by AWS KMS,
                with Additional Authenticated Data (AAD) bound to the organization.
              </li>
            </ul>
          </section>

          {/* Section 5: User Rights */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Your Rights (GDPR &amp; CCPA/CPRA)
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Depending on your location, you hold statutory rights regarding your personal information:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>Right of Access:</strong> Request a full export of your organization&rsquo;s records.</li>
              <li><strong>Right to Rectification:</strong> Update inaccurate lead or profile information at any time.</li>
              <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Permanently delete leads, integration tokens, and organization records.</li>
              <li><strong>Right to Opt-Out:</strong> Prospects can immediately unsubscribe from automated cadences by replying STOP.</li>
            </ul>
          </section>

          {/* Section 6: Contact */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. Contact Our Privacy Office
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              To exercise your privacy rights, request data deletion, or inquire about compliance agreements (such as DPAs or BAAs), please contact:
              <br />
              <strong className="text-slate-900">Email:</strong> privacy@clientfollow.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} ClientFollow. All rights reserved. &bull; Enterprise Data Privacy &amp; Cryptographic Isolation
        </div>
      </main>
    </div>
  );
}
