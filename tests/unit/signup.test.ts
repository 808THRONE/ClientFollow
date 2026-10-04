import { describe, it, expect, vi } from "vitest";
import { validateBusinessEmail, SignupRequestSchema } from "@/lib/db/validators";
import { POST } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";

describe("Signup Email Validation & Dummy Protection", () => {
  it("rejects dummy and single-character emails like a@a.com", () => {
    expect(validateBusinessEmail("a@a.com").valid).toBe(false);
    expect(validateBusinessEmail("a@a.com").error).toContain("Invalid dummy email");
    expect(validateBusinessEmail("x@y.com").valid).toBe(false);
  });

  it("rejects invalid syntax, missing domains, or consecutive dots", () => {
    expect(validateBusinessEmail("notanemail").valid).toBe(false);
    expect(validateBusinessEmail("test@").valid).toBe(false);
    expect(validateBusinessEmail("test@domain").valid).toBe(false);
    expect(validateBusinessEmail("test..user@domain.com").valid).toBe(false);
  });

  it("accepts valid, realistic business email addresses", () => {
    expect(validateBusinessEmail("doctor@apexsmiles.com").valid).toBe(true);
    expect(validateBusinessEmail("sarah.connor@creativeagency.io").valid).toBe(true);
    expect(validateBusinessEmail("partner@lawfirm.org").valid).toBe(true);
  });

  it("validates SignupRequestSchema rejecting invalid emails", () => {
    const invalid = SignupRequestSchema.safeParse({
      businessName: "My Dental Practice",
      industry: "dentist",
      email: "a@a.com",
      password: "password123",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates SignupRequestSchema accepting valid payloads", () => {
    const valid = SignupRequestSchema.safeParse({
      businessName: "My Dental Practice",
      industry: "dentist",
      email: "owner@mydental.com",
      password: "password123",
    });
    expect(valid.success).toBe(true);
  });
});

describe("POST /api/auth/signup Route Handler", () => {
  it("returns 400 when invalid email like a@a.com is passed", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        businessName: "Apex Dental",
        industry: "dentist",
        email: "a@a.com",
        password: "password123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("dummy email");
  });

  it("returns 400 when password is under 8 characters", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        businessName: "Apex Dental",
        industry: "dentist",
        email: "doctor@apexsmiles.com",
        password: "123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("8 characters");
  });

  it("successfully signs up with valid credentials in sandbox mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        businessName: "Apex Dental Center",
        industry: "dentist",
        email: "doctor@apexsmiles.com",
        password: "securePassword123!",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.redirectUrl).toBe("/onboarding");
    expect(res.cookies.get("cf_session")).toBeDefined();
  });
});
