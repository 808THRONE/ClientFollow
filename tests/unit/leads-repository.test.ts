import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadsRepository } from "@/lib/db/leads.repository";
import { Lead } from "@/lib/db/types";

describe("LeadsRepository", () => {
  let mockSupabase: any;
  let repository: LeadsRepository;

  const sampleLead: Lead = {
    id: "lead_123",
    org_id: "org_test",
    name: "Dr. Sarah Jenkins",
    email: "sarah@example.com",
    phone: "+15551234567",
    status: "new_lead",
    source: "gmail",
    detected_service: "Teeth Whitening",
    detected_urgency: "high",
    sentiment: "positive",
    requires_approval: false,
    approval_pending: false,
    last_interaction_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };
    repository = new LeadsRepository(mockSupabase);
  });

  it("fetches leads for an organization filtered by org_id", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [sampleLead],
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });

    const results = await repository.getLeadsByOrg("org_test");

    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("org_id", "org_test");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("lead_123");
  });

  it("inserts a new lead with tenant binding", async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: sampleLead,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
    });
    mockInsert.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      single: mockSingle,
    });

    const created = await repository.createLead(sampleLead);

    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      org_id: "org_test",
      name: "Dr. Sarah Jenkins",
    }));
    expect(created.id).toBe("lead_123");
  });

  it("never inserts a client-supplied id (Postgres UUID is the source of truth)", async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...sampleLead, id: "uuid_generated_by_postgres" },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
    });
    mockInsert.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      single: mockSingle,
    });

    await repository.createLead({ ...sampleLead, id: "lead_1712345678901" });

    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow).not.toHaveProperty("id");
  });

  it("updates lead status with transition validation", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...sampleLead, status: "contacted" },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockBuilder: any = {};
    mockBuilder.eq = vi.fn().mockReturnValue(mockBuilder);
    mockBuilder.select = mockSelect;

    const mockUpdate = vi.fn().mockReturnValue(mockBuilder);
    mockSupabase.from.mockReturnValue({
      update: mockUpdate,
    });

    const updated = await repository.updateLeadStatus("lead_123", "org_test", "contacted");

    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "contacted",
    }));
    expect(updated?.status).toBe("contacted");
  });

  it("propagates database errors instead of silently swallowing them", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Connection timeout to PostgreSQL pool", code: "PGRST001" },
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });

    await expect(repository.getLeadsByOrg("org_test")).rejects.toThrow(
      "Database error fetching leads: Connection timeout to PostgreSQL pool"
    );
  });
});
