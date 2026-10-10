import type { InvoiceWithClient, Pot } from "@/types/domain";
import { formatMoney } from "@/lib/format";

interface Props {
  invoices: InvoiceWithClient[];
  pots: Pot[];
}

export function StatCards({ invoices, pots }: Props) {
  const open = invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED");
  const overdue = open.filter((i) => i.status === "OVERDUE");
  const outstandingCents = open.reduce((s, i) => s + i.amount_cents, 0);
  const atRiskCents = open.reduce((s, i) => s + i.amount_cents * (i.risk_score ?? 0), 0);
  const allocatedCents = pots.reduce((s, p) => s + p.balance_cents, 0);

  const cards = [
    { label: "Outstanding", value: formatMoney(outstandingCents), hint: `${open.length} open invoice(s)` },
    { label: "Overdue", value: String(overdue.length), hint: formatMoney(overdue.reduce((s, i) => s + i.amount_cents, 0)) },
    { label: "At-risk cash", value: formatMoney(atRiskCents), hint: "risk-weighted" },
    { label: "Allocated to pots", value: formatMoney(allocatedCents), hint: `${pots.length} pot(s)` },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          <p className="mt-0.5 text-xs text-slate-400">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
