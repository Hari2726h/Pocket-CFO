"use client";

import { useDashboardData } from "@/lib/useDashboardData";
import { StatCards } from "./StatCards";
import { InvoiceGrid } from "./InvoiceGrid";
import { PotsPanel } from "./PotsPanel";
import { CashflowChart } from "./CashflowChart";
import { ActivityFeed } from "./ActivityFeed";

export function Dashboard({ paypalConnected }: { paypalConnected: boolean }) {
  const {
    invoices,
    pots,
    activity,
    loading,
    busy,
    lastMessage,
    lastError,
    seedDemo,
    runAgentCycle,
    simulatePayment,
  } = useDashboardData();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-paypal-lightblue">Pocket CFO</p>
          <h1 className="text-2xl font-bold tracking-tight">Autonomous cash-flow agent</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Scores invoice risk, negotiates early-payment discounts, chases overdue clients, and auto-splits incoming
            PayPal payments across tax, reinvestment, buffer, and take-home pots — with zero manual bookkeeping.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-secondary" disabled={busy} onClick={seedDemo}>
            {busy ? "Working…" : "Seed demo data"}
          </button>
          <button className="btn-primary" disabled={busy} onClick={runAgentCycle}>
            {busy ? "Running…" : "▶ Run agent cycle"}
          </button>
        </div>
      </header>

      {(lastMessage || lastError) && (
        <div
          className={
            "mb-6 rounded-xl px-4 py-3 text-sm " +
            (lastError
              ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300")
          }
        >
          {lastError ?? lastMessage}
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No data yet. Click <strong>Seed demo data</strong> to load a realistic set of clients and invoices, then{" "}
            <strong>Run agent cycle</strong> to watch Pocket CFO work.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <StatCards invoices={invoices} pots={pots} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <div className="card p-5">
                <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Invoices</h2>
                <InvoiceGrid invoices={invoices} busy={busy} onSimulatePay={simulatePayment} />
              </div>
              <CashflowChart invoices={invoices} />
            </div>

            <div className="space-y-6">
              <PotsPanel pots={pots} />
              <ActivityFeed activity={activity} />
            </div>
          </div>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-slate-400">
        Built for the PayPal AI Hackathon ·{" "}
        {paypalConnected ? "PayPal sandbox connected" : "Sandbox not connected — PayPal calls are simulated until credentials are set in .env"}
      </footer>
    </div>
  );
}
