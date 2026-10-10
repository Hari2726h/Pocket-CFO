"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityEvent, InvoiceWithClient, Payout, Pot } from "@/types/domain";
import type { CycleSummary } from "@/lib/agent/orchestrator";

interface DashboardState {
  invoices: InvoiceWithClient[];
  pots: Pot[];
  payouts: Payout[];
  activity: ActivityEvent[];
  loading: boolean;
  busy: boolean;
  lastMessage: string | null;
  lastError: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({
    invoices: [],
    pots: [],
    payouts: [],
    activity: [],
    loading: true,
    busy: false,
    lastMessage: null,
    lastError: null,
  });

  const refreshAll = useCallback(async () => {
    const [invoicesRes, potsRes, payoutsRes, activityRes] = await Promise.all([
      fetchJson<{ invoices: InvoiceWithClient[] }>("/api/invoices"),
      fetchJson<{ pots: Pot[] }>("/api/pots"),
      fetchJson<{ payouts: Payout[] }>("/api/payouts"),
      fetchJson<{ activity: ActivityEvent[] }>("/api/activity"),
    ]);
    setState((s) => ({
      ...s,
      invoices: invoicesRes.invoices,
      pots: potsRes.pots,
      payouts: payoutsRes.payouts,
      activity: activityRes.activity,
      loading: false,
    }));
  }, []);

  useEffect(() => {
    refreshAll().catch((err) => setState((s) => ({ ...s, loading: false, lastError: String(err) })));
  }, [refreshAll]);

  const withBusy = useCallback(
    async (fn: () => Promise<string>) => {
      setState((s) => ({ ...s, busy: true, lastError: null }));
      try {
        const message = await fn();
        await refreshAll();
        setState((s) => ({ ...s, busy: false, lastMessage: message }));
      } catch (err) {
        setState((s) => ({ ...s, busy: false, lastError: (err as Error).message }));
      }
    },
    [refreshAll]
  );

  const seedDemo = useCallback(
    () =>
      withBusy(async () => {
        const res = await fetch("/api/seed", { method: "POST" });
        if (!res.ok) throw new Error("Seeding failed");
        return "Demo data seeded.";
      }),
    [withBusy]
  );

  const runAgentCycle = useCallback(
    () =>
      withBusy(async () => {
        const res = await fetch("/api/agent/run", { method: "POST" });
        const json = (await res.json()) as { ok: boolean; summary?: CycleSummary; error?: string };
        if (!json.ok || !json.summary) throw new Error(json.error ?? "Agent cycle failed");
        return `Agent cycle complete: ${json.summary.invoicesProcessed} invoice(s) reviewed, ${json.summary.remindersSent} reminder(s) sent, ${json.summary.discountsOffered} discount(s) offered.`;
      }),
    [withBusy]
  );

  const simulatePayment = useCallback(
    (invoiceId: string, invoiceNumber: string) =>
      withBusy(async () => {
        const res = await fetch("/api/simulate/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!json.ok) throw new Error(json.error ?? "Payment simulation failed");
        return `Payment for ${invoiceNumber} received — cash auto-split across pots.`;
      }),
    [withBusy]
  );

  return { ...state, refreshAll, seedDemo, runAgentCycle, simulatePayment };
}
