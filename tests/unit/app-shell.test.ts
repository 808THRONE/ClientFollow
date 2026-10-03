import { describe, it, expect } from "vitest";
import { DEMO_LEADS, DEMO_ORGANIZATION } from "@/lib/demo-data";
import { calculateUsagePercentage } from "@/lib/services/usage.service";

describe("App Shell Navigation & UI State", () => {
  it("computes accurate usage percentage for the sidebar progress bar", () => {
    const percentage = calculateUsagePercentage(42, DEMO_ORGANIZATION.active_leads_limit);
    expect(percentage).toBe(42);
  });

  it("calculates pending approvals badge count from demo leads", () => {
    const pendingCount = DEMO_LEADS.filter(
      (l) => l.requires_approval && l.status !== "lost"
    ).length;
    expect(pendingCount).toBe(2);
  });

  it("filters leads by search query across name, email, and detected service", () => {
    const query = "implants";
    const filtered = DEMO_LEADS.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(query.toLowerCase())) ||
        (l.email && l.email.toLowerCase().includes(query.toLowerCase())) ||
        (l.detected_service && l.detected_service.toLowerCase().includes(query.toLowerCase()))
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Dr. Amanda Vance");
  });
});
