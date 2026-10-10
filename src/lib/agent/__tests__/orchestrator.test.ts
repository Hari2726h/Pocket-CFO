import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { addDays, format, subDays } from "date-fns";

const TEST_DB_PATH = path.resolve(process.cwd(), `data/test-orchestrator-${process.pid}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB_PATH;
delete process.env.PAYPAL_CLIENT_ID;
delete process.env.PAYPAL_CLIENT_SECRET;
delete process.env.ANTHROPIC_API_KEY;

const { createClient, createInvoice, getInvoice, listPots, updateInvoice, upsertPot } = await import("@/lib/db/repo");
const { runAgentCycle, handlePaymentReceived } = await import("../orchestrator");

const DAY = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");

afterAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    if (fs.existsSync(TEST_DB_PATH + ext)) fs.rmSync(TEST_DB_PATH + ext);
  }
});

describe("runAgentCycle — discount window stability", () => {
  it("does not immediately overwrite an outstanding, unexpired discount offer with a plain reminder", async () => {
    const client = createClient({ name: "Risky Client", email: "risky@example.com", on_time_rate: 0.4, avg_days_late: 20 });
    const invoice = createInvoice({
      client_id: client.id,
      number: "T-DISCOUNT",
      description: "Large risky invoice",
      amount_cents: 500_000,
      issued_date: DAY(-5),
      due_date: DAY(2),
      status: "SENT",
    });
    updateInvoice(invoice.id, { paypal_invoice_id: "SIMULATED-already-sent" });

    const first = await runAgentCycle();
    const afterFirst = getInvoice(invoice.id)!;
    expect(afterFirst.status).toBe("DISCOUNT_OFFERED");
    expect(afterFirst.discount_offered_pct).not.toBeNull();
    const firstStep = first.steps.find((s) => s.invoiceId === invoice.id)!;
    expect(firstStep.action).toBe("DISCOUNT_OFFERED");

    // Running the cycle again immediately (no simulated time passing) should
    // leave the offer standing rather than burying it under a reminder.
    const second = await runAgentCycle();
    const afterSecond = getInvoice(invoice.id)!;
    expect(afterSecond.status).toBe("DISCOUNT_OFFERED");
    const secondStep = second.steps.find((s) => s.invoiceId === invoice.id)!;
    expect(secondStep.action).toBe("NO_ACTION");
    expect(secondStep.detail).toMatch(/waiting/i);
  });

  it("resumes reminders once an outstanding discount offer has expired", async () => {
    const client = createClient({ name: "Expired Offer Client", email: "expired@example.com", on_time_rate: 0.4, avg_days_late: 20 });
    const invoice = createInvoice({
      client_id: client.id,
      number: "T-EXPIRED",
      description: "Invoice with a lapsed discount offer",
      amount_cents: 500_000,
      issued_date: DAY(-10),
      due_date: DAY(-1),
      status: "DISCOUNT_OFFERED",
    });
    updateInvoice(invoice.id, {
      paypal_invoice_id: "SIMULATED-already-sent",
      discount_offered_pct: 0.03,
      discount_expires_at: DAY(-2), // already in the past
    });

    const summary = await runAgentCycle();
    const step = summary.steps.find((s) => s.invoiceId === invoice.id)!;
    expect(step.action).toBe("REMINDER_SENT");
    expect(getInvoice(invoice.id)!.status).toBe("OVERDUE");
  });
});

describe("handlePaymentReceived — idempotency", () => {
  it("does not double-credit pots when called twice for the same invoice", async () => {
    upsertPot({ key: "tax", name: "Tax", allocation_pct: 1, paypal_payout_receiver: "tax@example.com", color: "#000" });
    const pots = listPots();
    const pot = pots.find((p) => p.key === "tax")!;

    const client = createClient({ name: "Paying Client", email: "paying@example.com" });
    const invoice = createInvoice({
      client_id: client.id,
      number: "T-PAID-TWICE",
      description: "Invoice that gets a duplicate payment webhook",
      amount_cents: 100_000,
      issued_date: DAY(-10),
      due_date: DAY(-1),
      status: "SENT",
    });
    updateInvoice(invoice.id, { paypal_invoice_id: "SIMULATED-already-sent" });

    const first = await handlePaymentReceived(invoice.id);
    expect(first.alreadyProcessed).toBeFalsy();
    expect(first.allocations.reduce((s, a) => s + a.amountCents, 0)).toBe(100_000);

    const balanceAfterFirst = listPots().find((p) => p.id === pot.id)!.balance_cents;

    // Simulate a duplicate webhook delivery / double-click.
    const second = await handlePaymentReceived(invoice.id);
    expect(second.alreadyProcessed).toBe(true);
    expect(second.allocations).toEqual([]);

    const balanceAfterSecond = listPots().find((p) => p.id === pot.id)!.balance_cents;
    expect(balanceAfterSecond).toBe(balanceAfterFirst);
  });
});
