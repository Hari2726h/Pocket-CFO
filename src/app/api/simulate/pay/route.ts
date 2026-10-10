import { NextRequest, NextResponse } from "next/server";
import { handlePaymentReceived } from "@/lib/agent/orchestrator";

/**
 * Dev/demo endpoint standing in for a real PayPal webhook delivery. Real
 * webhooks require a publicly reachable HTTPS URL (e.g. via ngrok) — this
 * lets judges/you trigger the exact same downstream logic
 * (lib/agent/orchestrator.ts#handlePaymentReceived) with one click from the
 * dashboard instead of standing up a tunnel.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const invoiceId = body?.invoiceId as string | undefined;
  if (!invoiceId) {
    return NextResponse.json({ ok: false, error: "invoiceId is required" }, { status: 400 });
  }

  try {
    const result = await handlePaymentReceived(invoiceId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[api/simulate/pay] failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
