"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  Sparkles,
  Settings,
  CreditCard,
  ShieldCheck,
  Zap,
  Mail,
  MessageSquare,
  Calendar,
  Building2,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { calculateUsagePercentage } from "@/lib/services/usage.service";
import { DEMO_ORGANIZATION } from "@/lib/demo-data";

interface SidebarProps {
  pendingApprovalsCount?: number;
  currentActiveLeads?: number;
  onQuickLeadClick?: () => void;
}

export function Sidebar({
  pendingApprovalsCount = 2,
  currentActiveLeads = 42,
  onQuickLeadClick,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const usagePercentage = calculateUsagePercentage(
    currentActiveLeads,
    DEMO_ORGANIZATION.active_leads_limit
  );

  const handleLogout = async () => {
    await fetch("/api/auth/login", { method: "DELETE" });
    window.location.href = "/login";
  };

  const navItems = [
    {
      name: "Pipeline Kanban",
      href: "/",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: "Approval Queue",
      href: "/approvals",
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    },
    {
      name: "Niche Playbooks",
      href: "/playbooks",
      icon: BookOpen,
      badge: "5",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-100",
    },
    {
      name: "Revenue Scanner",
      href: "/onboarding",
      icon: Sparkles,
      badge: "Auto",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    {
      name: "Settings & Billing",
      href: "/settings",
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between h-screen sticky top-0">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200 group-hover:bg-blue-700 transition-colors">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900">
                  ClientFollow
                </span>
                <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 uppercase tracking-wide border border-blue-100">
                  MVP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Automated Revenue Recovery</p>
            </div>
          </Link>

          {/* Active Workspace / Org */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="font-medium text-slate-700 truncate">
                {DEMO_ORGANIZATION.name}
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Active
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-blue-600" : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Channel Health Status */}
        <div className="mx-3 mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2.5">
          <div className="flex items-center justify-between text-slate-500 font-medium">
            <span>Connected Channels</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
              3 Online
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-blue-500" /> Gmail OAuth
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-emerald-500" /> WhatsApp Cloud
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-amber-500" /> Google Calendar
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section: Usage Meter & Security */}
      <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
        {/* Lead Volume Soft-Cap Card */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-semibold text-slate-900">Growth Plan</span>
            <span className="text-slate-500">
              {currentActiveLeads} / {DEMO_ORGANIZATION.active_leads_limit} leads
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                usagePercentage >= 80 ? "bg-amber-500" : "bg-blue-600"
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>

          <Link
            href="/settings"
            className="flex items-center justify-between text-blue-600 hover:text-blue-700 font-semibold pt-0.5 group"
          >
            <span>Upgrade tier limits</span>
            <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
          <span className="truncate">NIST SP 800-57 KMS Protected</span>
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
