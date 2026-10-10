import { differenceInCalendarDays } from "date-fns";
import type { Client, Invoice } from "@/types/domain";
import { complete } from "./llm";

export interface RiskAssessment {
  score: number; // 0..1, probability this invoice ends up paid late or not at all
  rationale: string;
  factors: {
    clientReliability: number;
    historicalLateness: number;
    scheduleUrgency: number;
    reminderFatigue: number;
  };
}

/**
 * Deterministic risk model. Every factor is explainable, which matters for
 * a finance agent: judges and real users should be able to see *why* the
 * agent believes an invoice is risky, not just trust a black box.
 */
export function computeHeuristicRisk(client: Client, invoice: Invoice, today: Date): RiskAssessment {
  const clientReliability = clamp01(1 - client.on_time_rate);
  const historicalLateness = clamp01(client.avg_days_late / 30);

  const daysUntilDue = differenceInCalendarDays(new Date(invoice.due_date), today);
  // Urgency ramps as the due date approaches and keeps climbing once overdue.
  const scheduleUrgency = clamp01(daysUntilDue >= 7 ? 0.05 : (7 - daysUntilDue) / 14);

  const reminderFatigue = clamp01(invoice.reminder_count / 4);

  const score = clamp01(
    clientReliability * 0.4 + historicalLateness * 0.25 + scheduleUrgency * 0.25 + reminderFatigue * 0.1
  );

  const parts: string[] = [];
  parts.push(
    client.on_time_rate >= 0.9
      ? `${client.name} pays on time ${Math.round(client.on_time_rate * 100)}% of the time`
      : `${client.name} only pays on time ${Math.round(client.on_time_rate * 100)}% of the time`
  );
  if (client.avg_days_late > 0) {
    parts.push(`averages ${client.avg_days_late.toFixed(0)} days late historically`);
  }
  if (daysUntilDue < 0) {
    parts.push(`this invoice is already ${Math.abs(daysUntilDue)} day(s) overdue`);
  } else if (daysUntilDue <= 7) {
    parts.push(`due in ${daysUntilDue} day(s)`);
  }
  if (invoice.reminder_count > 0) {
    parts.push(`${invoice.reminder_count} reminder(s) already sent with no payment`);
  }

  return {
    score,
    rationale: capitalize(parts.join("; ")) + ".",
    factors: { clientReliability, historicalLateness, scheduleUrgency, reminderFatigue },
  };
}

/** Heuristic score + (optional) LLM-polished rationale for the activity feed. */
export async function scoreInvoiceRisk(client: Client, invoice: Invoice, today: Date): Promise<RiskAssessment> {
  const base = computeHeuristicRisk(client, invoice, today);

  const polished = await complete(
    "You are a cautious finance operations analyst. Rewrite the given risk rationale in one crisp sentence " +
      "(max 30 words) for a small-business owner's dashboard. State the computed risk level in plain language. " +
      "Do not invent new facts beyond what is given. No preamble, return only the sentence.",
    `Client: ${client.name}\nRisk score: ${(base.score * 100).toFixed(0)}/100\nFactors: ${base.rationale}`
  );

  return polished ? { ...base, rationale: polished } : base;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
