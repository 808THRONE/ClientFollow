"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { MailCheck, RefreshCw, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, Zap } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "your email address";

  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setError(null);
    setResendStatus(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to resend verification email.");
      } else {
        setResendStatus(data.message || "A new verification link has been sent to your inbox.");
        setCooldown(60); // 60s cooldown
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to server";
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  const handleInstantSandboxVerify = () => {
    // Navigates through the /auth/callback route to establish the sandbox session
    router.push(`/auth/callback?email=${encodeURIComponent(email)}&next=/onboarding`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <MailCheck className="h-7 w-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Check your inbox
        </h2>
        <p className="mt-2 text-center text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          We&apos;ve sent a secure verification link to <br />
          <span className="font-semibold text-slate-900 text-sm">{email}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl border border-slate-200/80 rounded-2xl sm:px-10 space-y-6">
          {resendStatus && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{resendStatus}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Next Steps:
            </h3>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Open the email sent from <strong>ClientFollow</strong>.</li>
              <li>Click the <strong>Confirm my account</strong> button in the message.</li>
              <li>Your workspace and revenue recovery dashboard will launch automatically.</li>
            </ol>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="w-full py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResending ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              {isResending
                ? "Sending link..."
                : cooldown > 0
                ? `Resend available in ${cooldown}s`
                : "Didn't receive it? Resend email"}
            </button>

            {/* Sandbox helper for seamless local testing without mail server */}
            <div className="pt-2 border-t border-slate-100">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-800">
                  <Zap className="h-3.5 w-3.5 text-blue-600" />
                  <span>Sandbox Quick-Pass</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-snug">
                  Testing on localhost without SMTP? You can instantly verify and proceed to onboarding:
                </p>
                <button
                  type="button"
                  onClick={handleInstantSandboxVerify}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Instant Verify & Launch Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center text-xs text-slate-500">
            Entered the wrong email?{" "}
            <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
              Return to Sign Up
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>FIPS 140-3 & HIPAA-Ready Cryptographic Verification</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          Loading verification status...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
