"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Send,
  MessageSquare,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { DEMO_LEADS } from "@/lib/demo-data";
import { Lead } from "@/lib/db/types";
import { filterPendingApprovals } from "@/lib/services/approval.service";
import { PipelineStatus } from "@/lib/services/pipeline-state.service";
import {
  getLeadsAction,
  updateLeadStatusAction,
  approveDraftAction,
  createLeadAction,
  deleteLeadAction,
  resendFollowUpAction,
} from "@/app/actions/leads";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await getLeadsAction("org_apex_dental");
        if (isMounted && res.success && res.leads && res.leads.length > 0) {
          setLeads(res.leads);
        }
      } catch (err: unknown) {
        console.warn("[DashboardPage] Offline fallback used:", err);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const currentLead = leads.find((l) => l.id === leadId);
    const oldStatus: PipelineStatus = (currentLead?.status as PipelineStatus) || "new_lead";
    const targetStatus = newStatus as PipelineStatus;

    // Optimistic UI state mutation
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );
    showNotification(`Lead moved to ${newStatus.replace("_", " ").toUpperCase()}`);

    try {
      const res = await updateLeadStatusAction(leadId, targetStatus, oldStatus, "org_apex_dental");
      if (!res.success) {
        // Revert optimistic state
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l))
        );
        showNotification(`Failed to move lead: ${res.error}`);
      }
    } catch (err: unknown) {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l))
      );
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DashboardPage] Status action notice: ${msg}`);
    }
  };

  const handleApproveLead = async (leadId: string) => {
    // Optimistic UI state mutation
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, approval_pending: false, requires_approval: false, status: "contacted" }
          : l
      )
    );
    showNotification("Follow-up draft approved and dispatched!");

    try {
      await approveDraftAction(leadId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DashboardPage] Approve action notice: ${msg}`);
    }
  };

  const handleAddLead = async (newLead: Lead) => {
    // Optimistic UI state mutation
    setLeads((prev) => [newLead, ...prev]);
    showNotification(`New lead "${newLead.name}" enrolled into cadence`);

    try {
      await createLeadAction({
        ...newLead,
        org_id: "org_apex_dental",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DashboardPage] Create lead action notice: ${msg}`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    showNotification("Lead removed from pipeline");
    try {
      await deleteLeadAction(leadId, "org_apex_dental");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DashboardPage] Delete lead notice: ${msg}`);
    }
  };

  const handleResendTouch = async (leadId: string) => {
    showNotification("Follow-up touch queued for dispatch");
    try {
      await resendFollowUpAction(leadId, "org_apex_dental");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DashboardPage] Resend notice: ${msg}`);
    }
  };

  const pendingApprovals = filterPendingApprovals(leads);

  const filteredLeads = leads.filter((l) => {
    // Channel filter
    if (channelFilter !== "all" && l.source !== channelFilter) return false;

    // Search query
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.detected_service && l.detected_service.toLowerCase().includes(q))
    );
  });

  const bookedCount = leads.filter((l) => l.status === "booked").length;
  const contactedCount = leads.filter((l) => l.status === "contacted").length;
  const repliedCount = leads.filter((l) => l.status === "replied").length;
  const estimatedRecoveredRevenue = bookedCount * 1250;

  return (
    <AppShell
      pendingApprovalsCount={pendingApprovals.length}
      currentActiveLeads={leads.length}
      onAddLead={handleAddLead}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="space-y-6">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Pending Approvals Notice Banner */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-amber-900">
                  {pendingApprovals.length} Follow-up {pendingApprovals.length === 1 ? "draft requires" : "drafts require"} manual approval
                </h4>
                <p className="text-xs text-amber-700">
                  Personalize and approve AI-generated messages before dispatching to prospective clients.
                </p>
              </div>
            </div>

            <Link
              href="/approvals"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <span>Review Queue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Active Leads</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{leads.length}</span>
              <span className="text-xs text-slate-400">across 5 stages</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Contacted (Follow-Ups)</span>
              <Send className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{contactedCount}</span>
              <span className="text-xs text-emerald-600 font-medium">In cadence</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Client Replies</span>
              <MessageSquare className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{repliedCount}</span>
              <span className="text-xs text-purple-600 font-medium">Instant Halt</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Revenue Recovered</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">
                ${new Intl.NumberFormat("en-US").format(estimatedRecoveredRevenue)}
              </span>
              <span className="text-xs text-slate-400">{bookedCount} Booked</span>
            </div>
          </div>
        </div>

        {/* Pipeline Controls & Channel Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Follow-Up Pipeline
            </h2>
            <p className="text-xs text-slate-500">
              Drag cards between stages or click any lead to view timeline, sentiment, and AI touch history.
            </p>
          </div>

          {/* Channel Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setChannelFilter("all")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  channelFilter === "all"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Channels
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter("gmail")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  channelFilter === "gmail"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Gmail
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter("whatsapp")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  channelFilter === "whatsapp"
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* 5-Column Kanban Board */}
        <div className="pt-2">
          <KanbanBoard
            initialLeads={filteredLeads}
            onStatusChange={handleStatusChange}
            onApproveLead={handleApproveLead}
            onDeleteLead={handleDeleteLead}
            onResendTouch={handleResendTouch}
          />
        </div>
      </div>
    </AppShell>
  );
}
