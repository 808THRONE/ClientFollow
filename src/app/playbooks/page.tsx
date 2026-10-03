"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PlaybookManager } from "@/components/playbooks/PlaybookManager";
import { DEMO_LEADS } from "@/lib/demo-data";
import { Lead } from "@/lib/db/types";

export default function PlaybooksPage() {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);

  const pendingCount = leads.filter(
    (l) => l.requires_approval && l.status !== "lost"
  ).length;

  const handleAddLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  };

  return (
    <AppShell
      pendingApprovalsCount={pendingCount}
      currentActiveLeads={leads.length}
      onAddLead={handleAddLead}
    >
      <PlaybookManager />
    </AppShell>
  );
}
