import { describe, expect, it } from "vitest";
import { addDays, subDays, format } from "date-fns";
import { computeHeuristicRisk } from "../risk";
import type { Client, Invoice } from "@/types/domain";

const today = new Date("2026-10-10T00:00:00Z");

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cli_1",
    name: "Test Client",
    email: "test@example.com",
    company: null,
    on_time_rate: 0.9,
    avg_days_late: 1,
    created_at: today.toISOString(),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    client_id: "cli_1",
    number: "INV-1",
    description: "Test invoice",
    amount_cents: 100000,
    currency: "USD",
    status: "SENT",
    issued_date: format(subDays(today, 10), "yyyy-MM-dd"),
    due_date: format(addDays(today, 20), "yyyy-MM-dd"),
    paid_date: null,
    paypal_invoice_id: null,
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

describe("computeHeuristicRisk", () => {
  it("scores a reliable client with a far-out due date as low risk", () => {
    const client = makeClient({ on_time_rate: 0.98, avg_days_late: 0 });
    const invoice = makeInvoice({ due_date: format(addDays(today, 30), "yyyy-MM-dd") });

    const result = computeHeuristicRisk(client, invoice, today);

    expect(result.score).toBeLessThan(0.2);
  });

  it("scores an unreliable, overdue, already-reminded client as high risk", () => {
    const client = makeClient({ on_time_rate: 0.3, avg_days_late: 25 });
    const invoice = makeInvoice({ due_date: format(subDays(today, 15), "yyyy-MM-dd"), reminder_count: 3 });

    const result = computeHeuristicRisk(client, invoice, today);

    expect(result.score).toBeGreaterThan(0.6);
    expect(result.rationale).toMatch(/overdue/i);
  });

  it("always returns a score clamped between 0 and 1", () => {
    const client = makeClient({ on_time_rate: 0, avg_days_late: 1000 });
    const invoice = makeInvoice({ due_date: format(subDays(today, 365), "yyyy-MM-dd"), reminder_count: 50 });

    const result = computeHeuristicRisk(client, invoice, today);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("increases risk monotonically as reminder count increases, all else equal", () => {
    const client = makeClient();
    const base = makeInvoice({ due_date: format(subDays(today, 5), "yyyy-MM-dd"), reminder_count: 0 });
    const reminded = makeInvoice({ due_date: format(subDays(today, 5), "yyyy-MM-dd"), reminder_count: 3 });

    const baseScore = computeHeuristicRisk(client, base, today).score;
    const remindedScore = computeHeuristicRisk(client, reminded, today).score;

    expect(remindedScore).toBeGreaterThan(baseScore);
  });
});
