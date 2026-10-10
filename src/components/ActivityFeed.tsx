import clsx from "clsx";
import type { ActivityEvent, ActivityType } from "@/types/domain";
import { relativeTime } from "@/lib/format";

const ICONS: Record<ActivityType, string> = {
  RISK_SCORED: "📊",
  REMINDER_SENT: "✉️",
  DISCOUNT_OFFERED: "🏷️",
  INVOICE_PAID: "✅",
  PAYOUT_SPLIT: "🔀",
  CYCLE_STARTED: "▶️",
  CYCLE_FINISHED: "⏹️",
};

const DIMMED: ActivityType[] = ["CYCLE_STARTED", "RISK_SCORED"];

export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  return (
    <div className="card flex h-full flex-col p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Agent activity</h2>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 520 }}>
        {activity.length === 0 && <p className="text-sm text-slate-400">No activity yet — seed demo data and run a cycle.</p>}
        {activity.map((event) => (
          <div key={event.id} className="flex gap-3">
            <div
              className={clsx(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
                DIMMED.includes(event.type)
                  ? "bg-slate-100 dark:bg-slate-800"
                  : "bg-blue-50 dark:bg-blue-900/30"
              )}
            >
              {ICONS[event.type]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">{event.summary}</p>
              <p className="text-xs text-slate-400">{relativeTime(event.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
