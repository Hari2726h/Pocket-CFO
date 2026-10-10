import { describe, expect, it } from "vitest";
import { addDays, format } from "date-fns";
import { decideDiscount } from "../discount";
import type { Invoice } from "@/types/domain";
import type { RiskAssessment } from "../risk";

const today = new Date("2026-10-10T00:00:00Z");

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    client_id: "cli_1",
    number: "INV-1",
    description: "Test invoice",
    amount_cents: 200_000,
    currency: "USD",
    status: "SENT",
    issued_date: format(today, "yyyy-MM-dd"),
    due_date: format(addDays(today, 10), "yyyy-MM-dd"),
    paid_date: null,
    paypal_invoice_id: "ppinv_1",
    paypal_invoice_number: null,
    risk_score: null,
    risk_rationale: null,
    discount_offered_pct: null,
    discount_expires_at: null,
    last_reminder_tone: null,
    reminder_count: 0,
    created_at: today.toISOString(),
    updated_at: today.toISOString(),
    ...overrides,
  };
}

function makeRisk(score: number): RiskAssessment {
  return { score, rationale: "test", factors: { clientReliability: 0, historicalLateness: 0, scheduleUrgency: 0, reminderFatigue: 0 } };
}

describe("decideDiscount", () => {
  it("offers a discount for a large, risky invoice with runway before the due date", () => {
    const decision = decideDiscount(makeInvoice(), makeRisk(0.7), today);

    expect(decision.offer).toBe(true);
    expect(decision.pct).toBeGreaterThan(0);
    expect(decision.pct).toBeLessThanOrEqual(0.05);
    expect(decision.expiresAt).not.toBeNull();
  });

  it("does not offer a discount for a small invoice", () => {
    const decision = decideDiscount(makeInvoice({ amount_cents: 2_000 }), makeRisk(0.9), today);
    expect(decision.offer).toBe(false);
  });

  it("does not offer a discount once past (or too close to) the due date", () => {
    const decision = decideDiscount(makeInvoice({ due_date: format(addDays(today, 1), "yyyy-MM-dd") }), makeRisk(0.9), today);
    expect(decision.offer).toBe(false);
  });

  it("does not offer a discount for an already-reliable (low risk) client", () => {
    const decision = decideDiscount(makeInvoice(), makeRisk(0.1), today);
    expect(decision.offer).toBe(false);
  });

  it("does not re-offer a discount if one is already outstanding", () => {
    const decision = decideDiscount(makeInvoice({ discount_offered_pct: 0.03 }), makeRisk(0.8), today);
    expect(decision.offer).toBe(false);
  });

  it("caps the discount percentage at 5%", () => {
    const decision = decideDiscount(makeInvoice(), makeRisk(1), today);
    expect(decision.pct).toBeLessThanOrEqual(0.05);
  });
});
