"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addWeeks, format, startOfWeek } from "date-fns";
import type { InvoiceWithClient } from "@/types/domain";
import { formatMoney } from "@/lib/format";

interface Bucket {
  label: string;
  expected: number;
  atRisk: number;
}

export function CashflowChart({ invoices }: { invoices: InvoiceWithClient[] }) {
  const data = useMemo<Bucket[]>(() => {
    const open = invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED");
    const weekStart = startOfWeek(new Date());
    const buckets: Bucket[] = Array.from({ length: 6 }, (_, i) => ({
      label: format(addWeeks(weekStart, i), "MMM d"),
      expected: 0,
      atRisk: 0,
    }));

    for (const inv of open) {
      const due = new Date(inv.due_date);
      const weeksOut = Math.max(0, Math.round((due.getTime() - weekStart.getTime()) / (7 * 24 * 3600 * 1000)));
      const idx = Math.min(weeksOut, buckets.length - 1);
      const risk = inv.risk_score ?? 0.15;
      const amount = inv.amount_cents * (1 - (inv.discount_offered_pct ?? 0));
      buckets[idx]!.expected += amount * (1 - risk);
      buckets[idx]!.atRisk += amount * risk;
    }

    return buckets;
  }, [invoices]);

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Projected cash flow (next 6 weeks)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="expected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0070ba" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0070ba" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="atRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(v) => `$${Math.round(v / 100 / 1000)}k`}
            width={44}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatMoney(value), name === "expected" ? "Expected" : "At risk"]}
            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
          />
          <Area type="monotone" dataKey="expected" stackId="1" stroke="#0070ba" fill="url(#expected)" strokeWidth={2} />
          <Area type="monotone" dataKey="atRisk" stackId="1" stroke="#ef4444" fill="url(#atRisk)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
