import type { Pot } from "@/types/domain";
import { formatMoney } from "@/lib/format";

export function PotsPanel({ pots }: { pots: Pot[] }) {
  const total = pots.reduce((sum, p) => sum + p.balance_cents, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cash pots</h2>
        <span className="text-xs text-slate-400">{formatMoney(total)} allocated</span>
      </div>
      <div className="space-y-4">
        {pots.map((pot) => (
          <div key={pot.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pot.color }} />
                {pot.name}
                <span className="text-xs font-normal text-slate-400">{Math.round(pot.allocation_pct * 100)}%</span>
              </span>
              <span className="tabular-nums font-semibold">{formatMoney(pot.balance_cents)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: total > 0 ? `${(pot.balance_cents / total) * 100}%` : "0%",
                  backgroundColor: pot.color,
                }}
              />
            </div>
          </div>
        ))}
        {pots.length === 0 && <p className="text-sm text-slate-400">No pots yet — seed demo data to get started.</p>}
      </div>
    </div>
  );
}
