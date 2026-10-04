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
  getOrgProfileAction,
} from "@/app/actions/leads";
import { rejectLeadSequence } from "@/app/actions/approval";
import { getSessionAction } from "@/app/actions/session";
import { estimateLeadValue } from "@/lib/services/lead-valuation";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [currentOrgId, setCurrentOrgId] = useState<string>("org_apex_dental");
  const [orgIndustry, setOrgIndustry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const session = await getSessionAction();
        const orgId = session?.orgId || "org_apex_dental";
        if (isMounted) {
          setCurrentOrgId(orgId);
        }

        const [profileRes, leadsRes] = await Promise.all([
          getOrgProfileAction(),
          getLeadsAction(orgId),
        ]);
        if (isMounted && profileRes.success && profileRes.industry) {
          setOrgIndustry(profileRes.industry);
        }
        if (isMounted && leadsRes.success && leadsRes.leads && leadsRes.leads.length > 0) {
          setLeads(leadsRes.leads);
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
    const formatStatus = (s: string) =>
      s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    showNotification(`Lead moved to ${formatStatus(newStatus)}`);

    try {
      const res = await updateLeadStatusAction(leadId, targetStatus, oldStatus, currentOrgId);
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
    const previousLeads = [...leads];
    // Optimistic UI state mutation
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, approval_pending: false, requires_approval: false, status: "contacted" }
          : l
      )
    );

    try {
      const res = await approveDraftAction(leadId);
      if (res?.success === false) {
        setLeads(previousLeads);
        showNotification(`Failed to approve lead: ${res.error || "Unknown error"}`);
      } else {
        showNotification("Follow-up draft approved and dispatched!");
      }
    } catch (err: unknown) {
      setLeads(previousLeads);
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Failed to approve lead: ${msg}`);
      console.warn(`[DashboardPage] Approve action notice: ${msg}`);
    }
  };

  const handleAddLead = async (newLead: Lead) => {
    // Optimistic UI state mutation (client-side key only — the server
    // assigns the real UUID and we reconcile on success).
    setLeads((prev) => [newLead, ...prev]);

    try {
      const res = await createLeadAction({
        ...newLead,
        org_id: currentOrgId,
      });
      if (res.success && res.lead) {
        setLeads((prev) =>
          prev.map((l) => (l.id === newLead.id ? { ...l, ...res.lead } : l))
        );
        showNotification(`New lead "${res.lead.name || newLead.name}" enrolled into cadence`);
      } else {
        setLeads((prev) => prev.filter((l) => l.id !== newLead.id));
        showNotification(`Failed to add lead: ${res.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      setLeads((prev) => prev.filter((l) => l.id !== newLead.id));
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Failed to add lead: ${msg}`);
    }
  };

  const handleRejectSequence = async (leadId: string) => {
    const previousLeads = [...leads];
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, approval_pending: false, status: "lost" } : l
      )
    );
    showNotification("Sequence rejected; follow-up cancelled");

    try {
      const res = await rejectLeadSequence({ leadId, reason: "Rejected from lead drawer" });
      if (res.success === false) {
        setLeads(previousLeads);
        showNotification(`Failed to reject sequence: ${res.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      setLeads(previousLeads);
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Failed to reject sequence: ${msg}`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    const previousLeads = [...leads];
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      const res = await deleteLeadAction(leadId, currentOrgId);
      if (res?.success === false) {
        setLeads(previousLeads);
        showNotification(`Failed to delete lead: ${res.error || "Unknown error"}`);
      } else {
        showNotification("Lead removed from pipeline");
      }
    } catch (err: unknown) {
      setLeads(previousLeads);
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(`Failed to delete lead: ${msg}`);
      console.warn(`[DashboardPage] Delete lead notice: ${msg}`);
    }
  };

  const handleResendTouch = async (leadId: string) => {
    showNotification("Follow-up touch queued for dispatch");
    try {
      await resendFollowUpAction(leadId, currentOrgId);
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
  const estimatedBookedValue = leads
    .filter((l) => l.status === "booked")
    .reduce((sum, l) => sum + estimateLeadValue(l, orgIndustry || undefined), 0);

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
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
          >
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
                  Personalize and approve follow-up drafts before they are sent to prospective clients.
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
                <span>Est. Booked Value</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">
                  ${new Intl.NumberFormat("en-US").format(estimatedBookedValue)}
                </span>
                <span className="text-xs text-slate-400">{bookedCount} Booked · estimated</span>
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
              Drag cards between stages or click any lead to view timeline, sentiment, and touch history.
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
            onRejectSequence={handleRejectSequence}
          />
        </div>
      </div>
    </AppShell>
  );
}
