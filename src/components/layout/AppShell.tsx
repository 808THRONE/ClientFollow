"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickLeadModal } from "@/components/pipeline/QuickLeadModal";
import { Lead } from "@/lib/db/types";

interface AppShellProps {
  children: React.ReactNode;
  pendingApprovalsCount?: number;
  currentActiveLeads?: number;
  onAddLead?: (lead: Lead) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function AppShell({
  children,
  pendingApprovalsCount = 2,
  currentActiveLeads = 42,
  onAddLead,
  searchQuery = "",
  onSearchChange,
}: AppShellProps) {
  const [isQuickLeadOpen, setIsQuickLeadOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLeadCreated = (newLead: Lead) => {
    if (onAddLead) {
      onAddLead(newLead);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          pendingApprovalsCount={pendingApprovalsCount}
          currentActiveLeads={currentActiveLeads}
          onQuickLeadClick={() => setIsQuickLeadOpen(true)}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 w-64 bg-white h-full shadow-2xl">
            <Sidebar
              pendingApprovalsCount={pendingApprovalsCount}
              currentActiveLeads={currentActiveLeads}
              onQuickLeadClick={() => {
                setMobileMenuOpen(false);
                setIsQuickLeadOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onQuickLeadClick={() => setIsQuickLeadOpen(true)}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Quick Add Lead Modal */}
      <QuickLeadModal
        isOpen={isQuickLeadOpen}
        onClose={() => setIsQuickLeadOpen(false)}
        onAddLead={handleLeadCreated}
      />
    </div>
  );
}
