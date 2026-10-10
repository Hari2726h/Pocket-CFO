"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import type { InvoiceWithClient } from "@/types/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { RiskBadge, StatusBadge } from "./Badge";

interface Props {
  invoices: InvoiceWithClient[];
  busy: boolean;
  onSimulatePay: (invoiceId: string, invoiceNumber: string) => void;
}

export function InvoiceGrid({ invoices, busy, onSimulatePay }: Props) {
  const columnDefs = useMemo<ColDef<InvoiceWithClient>[]>(
    () => [
      { field: "number", headerName: "Invoice", width: 120, pinned: "left" },
      { field: "client_name", headerName: "Client", flex: 1, minWidth: 160 },
      { field: "description", headerName: "Description", flex: 1.4, minWidth: 200 },
      {
        field: "amount_cents",
        headerName: "Amount",
        width: 130,
        valueFormatter: (p) => formatMoney(p.value as number, p.data?.currency),
        cellClass: "font-semibold tabular-nums",
      },
      {
        field: "due_date",
        headerName: "Due",
        width: 120,
        valueFormatter: (p) => formatDate(p.value as string),
      },
      {
        field: "status",
        headerName: "Status",
        width: 160,
        cellRenderer: (p: ICellRendererParams<InvoiceWithClient>) =>
          p.data ? <StatusBadge status={p.data.status} /> : null,
      },
      {
        field: "risk_score",
        headerName: "Risk",
        width: 140,
        cellRenderer: (p: ICellRendererParams<InvoiceWithClient>) => <RiskBadge score={p.data?.risk_score ?? null} />,
      },
      {
        headerName: "Discount",
        width: 110,
        valueGetter: (p) => (p.data?.discount_offered_pct ? `${(p.data.discount_offered_pct * 100).toFixed(1)}%` : "—"),
      },
      {
        headerName: "Action",
        width: 160,
        sortable: false,
        filter: false,
        cellRenderer: (p: ICellRendererParams<InvoiceWithClient>) => {
          const inv = p.data;
          if (!inv || inv.status === "PAID" || inv.status === "CANCELLED") {
            return <span className="text-xs text-slate-400">—</span>;
          }
          return (
            <button
              className="rounded-lg bg-paypal-gold px-2.5 py-1 text-xs font-semibold text-paypal-dark hover:brightness-95 disabled:opacity-50"
              disabled={busy}
              onClick={() => onSimulatePay(inv.id, inv.number)}
              title="Simulate the client paying this invoice right now"
            >
              Simulate payment
            </button>
          );
        },
      },
    ],
    [busy, onSimulatePay]
  );

  return (
    <div className="ag-theme-quartz h-[420px] w-full rounded-xl overflow-hidden" style={{ ["--ag-font-family" as string]: "inherit" }}>
      <AgGridReact<InvoiceWithClient>
        rowData={invoices}
        columnDefs={columnDefs}
        rowHeight={48}
        headerHeight={40}
        animateRows
        suppressCellFocus
        domLayout="normal"
      />
    </div>
  );
}
