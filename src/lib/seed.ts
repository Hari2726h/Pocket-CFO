import { addDays, format } from "date-fns";
import { getDb } from "@/lib/db";
import { createClient, createInvoice, logActivity, resetAllData, updateInvoice, upsertPot } from "@/lib/db/repo";
import { newId } from "@/lib/id";
import type { Invoice } from "@/types/domain";

const DAY = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");

/** Invoices seeded as already SENT/OVERDUE need a PayPal invoice id on
 *  record — otherwise the orchestrator (correctly) treats them as never
 *  having been sent yet and re-issues them instead of scoring/reminding. */
function markAsAlreadySentToPayPal(invoice: Invoice): Invoice {
  return updateInvoice(invoice.id, {
    paypal_invoice_id: `SIMULATED-${newId("ppinv")}`,
    paypal_invoice_number: invoice.number,
  });
}

/**
 * Deterministic, demo-friendly dataset: a spread of clients with different
 * reliability profiles and invoices in every interesting state (paid,
 * upcoming, due-soon, overdue) so a single "Run Agent Cycle" click produces
 * a visibly varied set of agent actions for the demo video.
 */
export function seedDemoData() {
  resetAllData();

  upsertPot({ key: "tax", name: "Tax Reserve", allocation_pct: 0.3, paypal_payout_receiver: pot("tax"), color: "#ef4444" });
  upsertPot({ key: "reinvest", name: "Reinvestment", allocation_pct: 0.2, paypal_payout_receiver: pot("reinvest"), color: "#3b82f6" });
  upsertPot({ key: "buffer", name: "Emergency Buffer", allocation_pct: 0.15, paypal_payout_receiver: pot("buffer"), color: "#f59e0b" });
  upsertPot({ key: "take_home", name: "Take-Home", allocation_pct: 0.35, paypal_payout_receiver: pot("take_home"), color: "#22c55e" });

  const acme = createClient({ name: "Priya Shah", email: "priya@acme-labs.test", company: "Acme Labs", on_time_rate: 0.95, avg_days_late: 1 });
  const nimbus = createClient({ name: "Derek Olsen", email: "derek@nimbuscloud.test", company: "Nimbus Cloud", on_time_rate: 0.55, avg_days_late: 14 });
  const brightside = createClient({ name: "Maya Chen", email: "maya@brightside.test", company: "Brightside Studio", on_time_rate: 0.8, avg_days_late: 3 });
  const forge = createClient({ name: "Tomas Rivera", email: "tomas@forgeworks.test", company: "Forgeworks", on_time_rate: 0.35, avg_days_late: 18 });

  // Already paid, historical — shows up in the ledger but needs no agent action.
  const paid = markAsAlreadySentToPayPal(
    createInvoice({
      client_id: acme.id,
      number: "INV-1001",
      description: "Q3 platform integration retainer",
      amount_cents: 480000,
      issued_date: DAY(-40),
      due_date: DAY(-25),
      status: "PAID",
      paid_date: DAY(-27),
    })
  );
  logActivity({ type: "INVOICE_PAID", client_id: acme.id, invoice_id: paid.id, summary: `${paid.number}: payment received from ${acme.name} (historical).` });

  // Comfortably upcoming — agent should leave this alone this cycle.
  markAsAlreadySentToPayPal(
    createInvoice({
      client_id: acme.id,
      number: "INV-1002",
      description: "Q4 API support block",
      amount_cents: 210000,
      issued_date: DAY(-5),
      due_date: DAY(21),
      status: "SENT",
    })
  );

  // Due soon, risky client — good discount-offer candidate.
  markAsAlreadySentToPayPal(
    createInvoice({
      client_id: nimbus.id,
      number: "INV-1010",
      description: "Infra migration — phase 2",
      amount_cents: 960000,
      issued_date: DAY(-12),
      due_date: DAY(2),
      status: "SENT",
    })
  );

  // Already overdue, mid-reliability client — firm reminder candidate.
  markAsAlreadySentToPayPal(
    createInvoice({
      client_id: brightside.id,
      number: "INV-1015",
      description: "Brand refresh — design sprint",
      amount_cents: 325000,
      issued_date: DAY(-30),
      due_date: DAY(-6),
      status: "OVERDUE",
      paid_date: null,
    })
  );

  // Badly overdue, unreliable client, already reminded twice — final-notice candidate.
  const risky = markAsAlreadySentToPayPal(
    createInvoice({
      client_id: forge.id,
      number: "INV-1020",
      description: "Ongoing retainer — October",
      amount_cents: 540000,
      issued_date: DAY(-45),
      due_date: DAY(-20),
      status: "OVERDUE",
    })
  );
  // Pre-seed two prior reminders so the next cycle escalates straight to FINAL.
  getDb().prepare(`UPDATE invoices SET reminder_count = 2, last_reminder_tone = 'FIRM' WHERE id = ?`).run(risky.id);

  // Draft, never sent — agent should create + send it via PayPal on first cycle.
  createInvoice({
    client_id: forge.id,
    number: "INV-1021",
    description: "November kickoff deposit",
    amount_cents: 150000,
    issued_date: DAY(0),
    due_date: DAY(14),
    status: "DRAFT",
  });

  logActivity({ type: "CYCLE_FINISHED", summary: "Demo data seeded. Click “Run Agent Cycle” to watch Pocket CFO work." });
}

function pot(key: string): string {
  return process.env[`PAYPAL_POT_${key.toUpperCase()}_RECEIVER`] || process.env.PAYPAL_SANDBOX_PAYOUT_RECEIVER || `sb-${key}@business.example.com`;
}
