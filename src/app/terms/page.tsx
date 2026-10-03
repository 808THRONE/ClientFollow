import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Zap, Scale, AlertTriangle, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Terms of Service | ClientFollow",
  description: "Terms of Service, AI automated agent disclosures, TCPA compliance, and liability terms.",
};

export default function TermsOfServicePage() {
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
            <Link href="/privacy" className="text-slate-600 hover:text-slate-900 transition-colors">
              Privacy Policy
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
              <Scale className="h-3.5 w-3.5" />
              Legal & Compliance Terms
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
            <p className="mt-2 text-xs text-slate-500">
              Effective Date: October 3, 2026 &bull; Version 2.2
            </p>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Important Notice Regarding Automated AI Communications:</p>
                <p>
                  ClientFollow utilizes artificial intelligence and automated outreach cadences. By using this service,
                  you acknowledge that you are responsible for maintaining legal opt-in consent for all leads and reviewing
                  AI-suggested messages before dispatch. See Sections 3, 4, and 5 for specific obligations and indemnifications.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. Acceptance of Terms & Services Description
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between ClientFollow (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
              and the subscribing entity or individual (&ldquo;Customer,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;). ClientFollow provides an autonomous revenue
              recovery, lead triage, and multi-channel follow-up orchestration platform designed for service businesses.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. Artificial Intelligence, Probabilistic Output &amp; Hallucination Disclaimer
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ClientFollow incorporates machine learning models, natural language processing, and automated reasoning tools
              provided by third-party model providers (including OpenAI, Anthropic, or configured local LLM runtimes).
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>
                <strong>Probabilistic Nature:</strong> AI outputs are non-deterministic and predictive recommendations.
                ClientFollow does not guarantee that AI-classified intents, sentiment analysis, or drafted messages are error-free, accurate, or complete.
              </li>
              <li>
                <strong>No Liability for AI Content (&ldquo;Hallucinations&rdquo;):</strong> ClientFollow shall not be held liable for inaccuracies,
                hallucinated statements, misquoted pricing, or unauthorized commitments made in AI-drafted communications.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. Human-in-the-Loop Safeguards &amp; Customer Responsibility
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ClientFollow provides an interactive <strong>Approval Queue</strong> feature allowing operators to review, edit, approve, or reject
              any sequence step. The Customer acknowledges and agrees that:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>
                The Customer retains full editorial control and final decision-making authority over all outbound communications sent through their accounts.
              </li>
              <li>
                If Customer enables autonomous dispatch without manual approval, Customer assumes full legal and financial responsibility for all transmitted content.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. Telecommunications, TCPA, and Messaging Compliance
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Customer represents and warrants that all prospect and lead data enrolled into ClientFollow complies with applicable telemarketing,
              anti-spam, and privacy regulations, including the <strong>Telephone Consumer Protection Act (TCPA)</strong>, <strong>CAN-SPAM Act</strong>,
              <strong>CTIA Messaging Principles</strong>, <strong>EU AI Act (Article 50)</strong>, and <strong>Meta WhatsApp Business Messaging Policies</strong>.
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>
                <strong>Prior Express Written Consent:</strong> Customer warrants that it has secured valid, verifiable consent from each recipient
                prior to initiating automated SMS or WhatsApp messages.
              </li>
              <li>
                <strong>Mandatory Opt-Out Honoring:</strong> Customer must not circumvent or disable automated unsubscribe mechanisms (such as STOP handlers).
              </li>
              <li>
                <strong>AI Identity Transparency:</strong> When required by local law (such as the EU AI Act or California SB 1001), Customer agrees not to
                deceptively represent automated communications as human without disclosing the automated nature of the assistant.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Customer Indemnification for Messaging Violations
            </h2>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
              Customer agrees to defend, indemnify, and hold harmless ClientFollow, its officers, directors, employees, and agents from and against
              any claims, liabilities, damages, losses, costs, or fines (including reasonable attorneys&rsquo; fees and statutory penalties under the TCPA,
              telecommunications statutes, or regulatory actions) arising out of or related to: (a) Customer&rsquo;s failure to obtain required consent;
              (b) unauthorized communications dispatched through Customer&rsquo;s integrations; or (c) Customer&rsquo;s breach of applicable messaging laws.
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. Non-Provision of Professional (Medical, Dental, Legal) Advice
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ClientFollow is an operational scheduling and lead management utility. It does <strong>not</strong> provide medical, dental, legal,
              accounting, or healthcare diagnoses or advice. Inquiries regarding health or legal matters must be evaluated by licensed professionals.
              ClientFollow is not a HIPAA Business Associate unless a separate Business Associate Agreement (BAA) has been executed in writing.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              7. Data Encryption &amp; Security Standards
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              All stored credentials and integration tokens are protected using NIST SP 800-57 compliant Envelope Encryption with AES-256-GCM
              and AWS Key Management Service (KMS). Tenant databases enforce PostgreSQL Row Level Security (RLS) policies to ensure data isolation.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              8. Limitation of Liability &amp; Class Action Waiver
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLIENTFOLLOW SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL,
              OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS REPUTATION. IN NO EVENT SHALL CLIENTFOLLOW&rsquo;S AGGREGATE
              LIABILITY EXCEED THE TOTAL FEES PAID BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              ALL CLAIMS MUST BE BROUGHT ON AN INDIVIDUAL BASIS AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              9. Contact Information
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              For questions concerning these Terms of Service or regulatory inquiries, contact us at:
              <br />
              <strong className="text-slate-900">Email:</strong> legal@clientfollow.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} ClientFollow. All rights reserved. &bull; NIST SP 800-57 &amp; FIPS 140-3 Compliant
        </div>
      </main>
    </div>
  );
}
