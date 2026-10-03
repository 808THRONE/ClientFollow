"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ApprovalQueue } from "@/components/approvals/ApprovalQueue";
import { DEMO_LEADS } from "@/lib/demo-data";
import { Lead } from "@/lib/db/types";

export default function ApprovalsPage() {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [searchQuery, setSearchQuery] = useState("");

  const pendingCount = leads.filter(
    (l) => l.requires_approval && l.status !== "lost"
  ).length;

  const handleAddLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  };

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.detected_service && l.detected_service.toLowerCase().includes(q))
    );
  });

  return (
    <AppShell
      pendingApprovalsCount={pendingCount}
      currentActiveLeads={leads.length}
      onAddLead={handleAddLead}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <ApprovalQueue initialLeads={filteredLeads} />
    </AppShell>
  );
}
