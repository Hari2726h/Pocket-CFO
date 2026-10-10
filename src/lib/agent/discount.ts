import { addDays, differenceInCalendarDays, format, min as minDate } from "date-fns";
import type { Invoice } from "@/types/domain";
import type { RiskAssessment } from "./risk";

export interface DiscountDecision {
  offer: boolean;
  pct: number | null;
  expiresAt: string | null;
  rationale: string;
}

const MIN_INVOICE_CENTS_FOR_DISCOUNT = 5_000; // $50 — below this, a discount isn't worth the cash-flow trade

/**
 * Negotiation policy: trade a small, capped discount for certainty and
 * speed of cash — but only while there's still runway before the due date
 * (an "early payment" discount offered after the due date is just a price
 * cut, not a cash-flow lever), and only for invoices large enough that the
 * acceleration is worth the margin given up.
 */
export function decideDiscount(invoice: Invoice, risk: RiskAssessment, today: Date): DiscountDecision {
  const daysUntilDue = differenceInCalendarDays(new Date(invoice.due_date), today);

  if (invoice.amount_cents < MIN_INVOICE_CENTS_FOR_DISCOUNT) {
    return { offer: false, pct: null, expiresAt: null, rationale: "Invoice too small for a discount to be worth the margin given up." };
  }
  if (daysUntilDue < 2) {
    return { offer: false, pct: null, expiresAt: null, rationale: "Too close to (or past) the due date for an early-payment incentive to make sense." };
  }
  if (risk.score < 0.35) {
    return { offer: false, pct: null, expiresAt: null, rationale: "Client's payment risk is already low — no incentive needed." };
  }
  if (invoice.discount_offered_pct) {
    return { offer: false, pct: null, expiresAt: null, rationale: "A discount offer is already outstanding on this invoice." };
  }

  // Scale 2%–5% with risk; higher risk clients get a slightly bigger nudge
  // to pay now rather than risk chasing them after the due date.
  const pct = round2(0.02 + risk.score * 0.03);
  const expiry = minDate([addDays(today, 3), new Date(invoice.due_date)]);

  return {
    offer: true,
    pct,
    expiresAt: format(expiry, "yyyy-MM-dd"),
    rationale: `Risk score ${(risk.score * 100).toFixed(0)}/100 with ${daysUntilDue} days of runway — offering ${(pct * 100).toFixed(1)}% to pull payment forward and reduce collection risk.`,
  };
}

function round2(n: number): number {
  return Math.round(n * 1000) / 1000;
}
