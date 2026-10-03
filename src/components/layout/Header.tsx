"use client";

import React from "react";
import {
  Search,
  Plus,
  Bell,
  Shield,
  Menu,
} from "lucide-react";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onQuickLeadClick?: () => void;
  onMobileMenuToggle?: () => void;
}

export function Header({
  searchQuery = "",
  onSearchChange,
  onQuickLeadClick,
  onMobileMenuToggle,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Mobile Menu & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads by name, email, or service inquiry..."
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Right Controls & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Security Assurance Badge */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200/90 px-3 py-1 text-xs text-slate-600 font-medium">
          <Shield className="h-3.5 w-3.5 text-blue-600" />
          <span>FIPS 140-3 HSM Active</span>
        </div>

        {/* Quick Inbound Intake CTA */}
        {onQuickLeadClick && (
          <button
            type="button"
            onClick={onQuickLeadClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>
        )}
      </div>
    </header>
  );
}
