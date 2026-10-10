import { differenceInCalendarDays } from "date-fns";
import {
  getClient,
  getInvoice,
  listOpenInvoices,
  listPots,
  logActivity,
  updateInvoice,
  createPayout,
  creditPot,
} from "@/lib/db/repo";
import type { Invoice, InvoiceWithClient } from "@/types/domain";
import { createAndSendInvoice, sendInvoiceReminder } from "@/lib/paypal/invoicing";
import { sendPayout } from "@/lib/paypal/payouts";
import { scoreInvoiceRisk } from "./risk";
import { draftReminder } from "./reminders";
import { decideDiscount } from "./discount";
import { allocatePayment } from "./allocation";

export interface CycleStepResult {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  action: "SENT_INITIAL_INVOICE" | "DISCOUNT_OFFERED" | "REMINDER_SENT" | "NO_ACTION";
  riskScore: number;
  detail: string;
}

export interface CycleSummary {
  startedAt: string;
  finishedAt: string;
  invoicesProcessed: number;
  remindersSent: number;
  discountsOffered: number;
  steps: CycleStepResult[];
}

/**
 * One autonomous pass over every open invoice: score risk, decide whether
 * to nudge-for-payment or negotiate an early-payment discount, and act on
 * that decision directly through the PayPal Invoicing API. This is the
 * "agent" in Pocket CFO — it doesn't just surface a risk number, it sends
 * the email / updates the invoice itself.
 */
export async function runAgentCycle(): Promise<CycleSummary> {
  const startedAt = new Date().toISOString();
  logActivity({ type: "CYCLE_STARTED", summary: "Agent cycle started." });

  const today = new Date();
  const invoices = listOpenInvoices();
  const steps: CycleStepResult[] = [];
  let remindersSent = 0;
  let discountsOffered = 0;

  for (const invoice of invoices) {
    const client = getClient(invoice.client_id);
    if (!client) continue;

    const step = await processInvoice(invoice, today);
    steps.push(step);
    if (step.action === "REMINDER_SENT") remindersSent++;
    if (step.action === "DISCOUNT_OFFERED") discountsOffered++;
  }

  const finishedAt = new Date().toISOString();
  logActivity({
    type: "CYCLE_FINISHED",
    summary: `Agent cycle finished: ${invoices.length} invoice(s) reviewed, ${remindersSent} reminder(s) sent, ${discountsOffered} discount(s) offered.`,
    detail: { remindersSent, discountsOffered, invoicesReviewed: invoices.length },
  });

  return {
    startedAt,
    finishedAt,
    invoicesProcessed: invoices.length,
    remindersSent,
    discountsOffered,
    steps,
  };
}

async function processInvoice(invoice: InvoiceWithClient, today: Date): Promise<CycleStepResult> {
  const client = getClient(invoice.client_id)!;

  // Step 1 — make sure the invoice actually exists in PayPal yet.
  if (invoice.status === "DRAFT" || !invoice.paypal_invoice_id) {
    const result = await createAndSendInvoice({
      invoiceNumber: invoice.number,
      recipientEmail: client.email,
      recipientName: client.name,
      description: invoice.description,
      amount: invoice.amount_cents / 100,
      currency: invoice.currency,
      dueDate: invoice.due_date,
    });

    updateInvoice(invoice.id, {
      status: "SENT",
      paypal_invoice_id: result.paypalInvoiceId,
      paypal_invoice_number: result.paypalInvoiceNumber,
    });

    logActivity({
      type: "REMINDER_SENT",
      client_id: client.id,
      invoice_id: invoice.id,
      summary: `Sent invoice ${invoice.number} to ${client.name} via PayPal${result.simulated ? " (simulated — no sandbox credentials configured)" : ""}.`,
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientName: client.name,
      action: "SENT_INITIAL_INVOICE",
      riskScore: 0,
      detail: "Initial invoice created and sent.",
    };
  }

  // Step 2 — score risk.
  const risk = await scoreInvoiceRisk(client, invoice, today);
  updateInvoice(invoice.id, { risk_score: risk.score, risk_rationale: risk.rationale });
  logActivity({
    type: "RISK_SCORED",
    client_id: client.id,
    invoice_id: invoice.id,
    summary: `${invoice.number}: risk ${(risk.score * 100).toFixed(0)}/100 — ${risk.rationale}`,
    detail: risk.factors,
  });

  // Step 3 — decide: negotiate a discount, or nudge for payment.
  const discount = decideDiscount(invoice, risk, today);

  if (discount.offer && discount.pct && discount.expiresAt) {
    const pctLabel = (discount.pct * 100).toFixed(1);
    await sendInvoiceReminder({
      paypalInvoiceId: invoice.paypal_invoice_id,
      subject: `Pay early and save ${pctLabel}% on invoice ${invoice.number}`,
      note:
        `Hi ${client.name.split(" ")[0]},\n\n` +
        `If you pay invoice ${invoice.number} by ${discount.expiresAt}, we'll apply a ${pctLabel}% early-payment discount — ` +
        `reply to this note or pay as usual and we'll reconcile the adjusted amount.\n\nThanks!`,
    });

    updateInvoice(invoice.id, {
      status: "DISCOUNT_OFFERED",
      discount_offered_pct: discount.pct,
      discount_expires_at: discount.expiresAt,
    });

    logActivity({
      type: "DISCOUNT_OFFERED",
      client_id: client.id,
      invoice_id: invoice.id,
      summary: `${invoice.number}: offered ${pctLabel}% early-payment discount, expires ${discount.expiresAt}. ${discount.rationale}`,
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientName: client.name,
      action: "DISCOUNT_OFFERED",
      riskScore: risk.score,
      detail: discount.rationale,
    };
  }

  // Step 4 — otherwise, send/escalate a reminder.
  const daysUntilDue = differenceInCalendarDays(new Date(invoice.due_date), today);
  const shouldRemind = daysUntilDue <= 3; // within reminder window or already overdue

  if (shouldRemind) {
    const reminder = await draftReminder(client, invoice, today);
    const result = await sendInvoiceReminder({
      paypalInvoiceId: invoice.paypal_invoice_id,
      subject: reminder.subject,
      note: reminder.note,
    });

    const nextStatus: Invoice["status"] = daysUntilDue < 0 ? "OVERDUE" : "REMINDED";
    updateInvoice(invoice.id, { status: nextStatus, last_reminder_tone: reminder.tone, incrementReminder: true });

    logActivity({
      type: "REMINDER_SENT",
      client_id: client.id,
      invoice_id: invoice.id,
      summary: `${invoice.number}: ${reminder.tone.toLowerCase()} reminder sent to ${client.name}${result.simulated ? " (simulated)" : ""}.`,
      detail: { subject: reminder.subject, tone: reminder.tone },
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientName: client.name,
      action: "REMINDER_SENT",
      riskScore: risk.score,
      detail: `${reminder.tone} reminder sent.`,
    };
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    clientName: client.name,
    action: "NO_ACTION",
    riskScore: risk.score,
    detail: "Not due soon enough yet — no action needed this cycle.",
  };
}

export interface PaymentReceivedResult {
  invoiceId: string;
  amountCents: number;
  allocations: Array<{ potKey: string; potName: string; amountCents: number; simulated: boolean }>;
}

/**
 * Called when a payment capture is observed (via PayPal webhook or the
 * /api/simulate/pay dev endpoint). This is the other half of "agentic
 * commerce": the agent doesn't just wait for a human to decide what to do
 * with the cash — it immediately re-distributes it across pots via real
 * PayPal Payouts.
 */
export async function handlePaymentReceived(invoiceId: string): Promise<PaymentReceivedResult> {
  const invoice = getInvoiceOrThrow(invoiceId);
  const client = getClient(invoice.client_id)!;

  updateInvoice(invoice.id, { status: "PAID", paid_date: new Date().toISOString().slice(0, 10) });
  logActivity({
    type: "INVOICE_PAID",
    client_id: client.id,
    invoice_id: invoice.id,
    summary: `${invoice.number}: payment received from ${client.name} (${formatMoney(invoice.amount_cents, invoice.currency)}).`,
  });

  const pots = listPots();
  const allocations = allocatePayment(invoice.amount_cents, pots);

  const results: PaymentReceivedResult["allocations"] = [];
  for (const line of allocations) {
    const pot = pots.find((p) => p.id === line.potId)!;
    const payout = await sendPayout({
      receiverEmail: pot.paypal_payout_receiver,
      amount: line.amountCents / 100,
      currency: invoice.currency,
      note: `Pocket CFO auto-allocation from invoice ${invoice.number} (${pot.name})`,
      senderItemId: `${invoice.id}-${pot.key}`,
    });

    createPayout({
      invoice_id: invoice.id,
      pot_id: pot.id,
      amount_cents: line.amountCents,
      paypal_payout_batch_id: payout.batchId,
      paypal_payout_item_id: payout.itemId,
      status: payout.simulated ? "SIMULATED" : "SUCCESS",
    });
    creditPot(pot.id, line.amountCents);

    results.push({ potKey: pot.key, potName: pot.name, amountCents: line.amountCents, simulated: payout.simulated });
  }

  logActivity({
    type: "PAYOUT_SPLIT",
    client_id: client.id,
    invoice_id: invoice.id,
    summary: `${invoice.number}: ${formatMoney(invoice.amount_cents, invoice.currency)} auto-split across ${results.length} pot(s).`,
    detail: results,
  });

  return { invoiceId: invoice.id, amountCents: invoice.amount_cents, allocations: results };
}

function getInvoiceOrThrow(invoiceId: string) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new Error(`invoice ${invoiceId} not found`);
  return invoice;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
