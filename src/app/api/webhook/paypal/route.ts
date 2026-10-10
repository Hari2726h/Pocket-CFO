import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handlePaymentReceived } from "@/lib/agent/orchestrator";
import { verifyWebhookSignature, paypalWebhooksEnabled } from "@/lib/paypal/webhooks";
import type { Invoice } from "@/types/domain";

const PAID_EVENT_TYPES = new Set(["INVOICING.INVOICE.PAID", "PAYMENT.CAPTURE.COMPLETED"]);

/**
 * Real PayPal webhook receiver. Configure this URL (https://<your-tunnel>/api/webhook/paypal)
 * in the Developer Dashboard under your app's webhooks, subscribed to
 * INVOICING.INVOICE.PAID and PAYMENT.CAPTURE.COMPLETED. Without a public
 * URL configured, use the "Simulate Payment" button in the dashboard
 * instead — it drives the identical downstream handler.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  // PayPal webhook payloads vary by event type and aren't worth fully typing
  // for a dev/demo receiver — every field below is read defensively.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  if (paypalWebhooksEnabled()) {
    const verified = await verifyWebhookSignature({
      transmissionId: req.headers.get("paypal-transmission-id") ?? "",
      transmissionTime: req.headers.get("paypal-transmission-time") ?? "",
      certUrl: req.headers.get("paypal-cert-url") ?? "",
      authAlgo: req.headers.get("paypal-auth-algo") ?? "",
      transmissionSig: req.headers.get("paypal-transmission-sig") ?? "",
      webhookId: process.env.PAYPAL_WEBHOOK_ID!,
      webhookEvent: event,
    });
    if (!verified) {
      return NextResponse.json({ ok: false, error: "signature verification failed" }, { status: 400 });
    }
  }

  if (!PAID_EVENT_TYPES.has(event.event_type)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Different event types surface the invoice reference under different
  // keys — the resource's own id for INVOICING.INVOICE.PAID, or a related-id
  // back-reference (by either PayPal's internal id or the human-readable
  // invoice number) for PAYMENT.CAPTURE.COMPLETED.
  const paypalInvoiceId: string | undefined = event.resource?.id;
  const relatedInvoiceId: string | undefined =
    event.resource?.invoice_id ?? event.resource?.supplementary_data?.related_ids?.invoice_id;

  if (!paypalInvoiceId && !relatedInvoiceId) {
    return NextResponse.json({ ok: false, error: "no invoice reference on event" }, { status: 400 });
  }

  const db = getDb();
  const invoice =
    (paypalInvoiceId &&
      (db.prepare(`SELECT * FROM invoices WHERE paypal_invoice_id = ?`).get(paypalInvoiceId) as Invoice | undefined)) ||
    (relatedInvoiceId &&
      ((db.prepare(`SELECT * FROM invoices WHERE paypal_invoice_id = ?`).get(relatedInvoiceId) as Invoice | undefined) ??
        (db.prepare(`SELECT * FROM invoices WHERE paypal_invoice_number = ?`).get(relatedInvoiceId) as
          | Invoice
          | undefined)));

  if (!invoice) {
    return NextResponse.json({ ok: false, error: "no matching invoice" }, { status: 404 });
  }

  const result = await handlePaymentReceived(invoice.id);
  return NextResponse.json({ ok: true, result });
}
