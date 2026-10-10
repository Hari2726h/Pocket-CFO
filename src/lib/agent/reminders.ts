import { differenceInCalendarDays } from "date-fns";
import type { Client, Invoice, ReminderTone } from "@/types/domain";
import { complete } from "./llm";

export function decideReminderTone(invoice: Invoice, today: Date): ReminderTone {
  const daysOverdue = -differenceInCalendarDays(new Date(invoice.due_date), today);
  if (daysOverdue > 14 || invoice.reminder_count >= 2) return "FINAL";
  if (daysOverdue > 0 || invoice.reminder_count >= 1) return "FIRM";
  return "FRIENDLY";
}

export interface DraftedReminder {
  subject: string;
  note: string;
  tone: ReminderTone;
}

const TEMPLATES: Record<ReminderTone, (c: Client, i: Invoice, daysOverdue: number) => DraftedReminder> = {
  FRIENDLY: (c, i) => ({
    subject: `Friendly heads-up: invoice ${i.number} is due soon`,
    note:
      `Hi ${c.name.split(" ")[0]},\n\n` +
      `Just a quick heads-up that invoice ${i.number} (${formatMoney(i.amount_cents, i.currency)}) for "${i.description}" ` +
      `is due on ${i.due_date}. No action needed if it's already scheduled — just flagging it in case it slipped by.\n\n` +
      `Thanks for the continued partnership!`,
    tone: "FRIENDLY",
  }),
  FIRM: (c, i, daysOverdue) => ({
    subject: `Action needed: invoice ${i.number} is ${Math.max(daysOverdue, 0)} day(s) overdue`,
    note:
      `Hi ${c.name.split(" ")[0]},\n\n` +
      `Invoice ${i.number} (${formatMoney(i.amount_cents, i.currency)}) for "${i.description}" was due on ${i.due_date} ` +
      `and is still outstanding. Could you let me know when payment is expected, or settle it directly via the link below?\n\n` +
      `If there's an issue on your end I'm happy to work it out — just reply to this note.`,
    tone: "FIRM",
  }),
  FINAL: (c, i, daysOverdue) => ({
    subject: `Final notice: invoice ${i.number} — ${daysOverdue} days overdue`,
    note:
      `Hi ${c.name.split(" ")[0]},\n\n` +
      `This is a final reminder that invoice ${i.number} (${formatMoney(i.amount_cents, i.currency)}) is now ${daysOverdue} days ` +
      `overdue. Please process payment as soon as possible to keep your account in good standing. ` +
      `If payment has already been sent, let me know so I can reconcile it.`,
    tone: "FINAL",
  }),
};

/** Deterministic template + optional LLM polish for natural phrasing. */
export async function draftReminder(client: Client, invoice: Invoice, today: Date): Promise<DraftedReminder> {
  const tone = decideReminderTone(invoice, today);
  const daysOverdue = -differenceInCalendarDays(new Date(invoice.due_date), today);
  const base = TEMPLATES[tone](client, invoice, daysOverdue);

  const polishedNote = await complete(
    "You are an AI finance operations agent drafting a payment-reminder email on behalf of a small business. " +
      `Tone should be ${tone === "FRIENDLY" ? "warm and low-pressure" : tone === "FIRM" ? "direct but professional" : "firm, final, and unambiguous without being rude"}. ` +
      "Keep all factual details (invoice number, amount, due date, days overdue) unchanged. Keep it under 120 words. " +
      "Return only the email body, no subject line, no preamble.",
    base.note
  );

  return polishedNote ? { ...base, note: polishedNote } : base;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
