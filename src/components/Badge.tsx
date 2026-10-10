import clsx from "clsx";
import type { InvoiceStatus } from "@/types/domain";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  VIEWED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  REMINDED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  DISCOUNT_OFFERED: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  REMINDED: "Reminded",
  OVERDUE: "Overdue",
  DISCOUNT_OFFERED: "Discount offered",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={clsx("pill", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>;
}

export function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "bg-red-500" : score >= 0.35 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">{pct}</span>
    </div>
  );
}
