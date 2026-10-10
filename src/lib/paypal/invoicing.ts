import { newId } from "@/lib/id";
import { paypalConfigured, SIMULATED_PREFIX } from "./env";
import { paypalRequest, paypalRequestWithLocation } from "./client";

export interface CreateInvoiceInput {
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  description: string;
  amount: number; // major units, e.g. 1250.00
  currency: string;
  dueDate: string; // YYYY-MM-DD
  note?: string;
}

export interface CreateInvoiceResult {
  paypalInvoiceId: string;
  paypalInvoiceNumber: string;
  simulated: boolean;
}

/**
 * Creates (drafts) and sends a PayPal invoice via the Invoicing v2 API.
 * Falls back to a deterministic simulated id when sandbox credentials are
 * not configured, so the rest of the product is fully exercisable offline.
 */
export async function createAndSendInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  if (!paypalConfigured()) {
    return {
      paypalInvoiceId: `${SIMULATED_PREFIX}${newId("ppinv")}`,
      paypalInvoiceNumber: input.invoiceNumber,
      simulated: true,
    };
  }

  const draft = await paypalRequest<{ id: string; href: string }>("/v2/invoicing/invoices", {
    method: "POST",
    body: {
      detail: {
        invoice_number: input.invoiceNumber,
        currency_code: input.currency,
        note: input.note,
        payment_term: { due_date: input.dueDate },
      },
      invoicer: {},
      primary_recipients: [
        {
          billing_info: {
            name: { full_name: input.recipientName },
            email_address: input.recipientEmail,
          },
        },
      ],
      items: [
        {
          name: input.description.slice(0, 200),
          quantity: "1",
          unit_amount: { currency_code: input.currency, value: input.amount.toFixed(2) },
        },
      ],
    },
  });

  await paypalRequestWithLocation(`/v2/invoicing/invoices/${draft.id}/send`, {
    method: "POST",
    body: { send_to_recipient: true },
  });

  return {
    paypalInvoiceId: draft.id,
    paypalInvoiceNumber: input.invoiceNumber,
    simulated: false,
  };
}

export interface ReminderInput {
  paypalInvoiceId: string;
  subject: string;
  note: string;
}

export async function sendInvoiceReminder(input: ReminderInput): Promise<{ simulated: boolean }> {
  if (!paypalConfigured() || input.paypalInvoiceId.startsWith(SIMULATED_PREFIX)) {
    return { simulated: true };
  }

  await paypalRequest(`/v2/invoicing/invoices/${input.paypalInvoiceId}/remind`, {
    method: "POST",
    body: {
      subject: input.subject,
      note: input.note,
      send_to_recipient: true,
    },
  });

  return { simulated: false };
}

/** Fetch the current status of an invoice from PayPal (used to confirm a
 *  payment capture out-of-band from the webhook, e.g. on dashboard refresh). */
export async function getInvoiceStatus(paypalInvoiceId: string): Promise<string | null> {
  if (!paypalConfigured() || paypalInvoiceId.startsWith(SIMULATED_PREFIX)) {
    return null;
  }
  const res = await paypalRequest<{ status: string }>(`/v2/invoicing/invoices/${paypalInvoiceId}`);
  return res.status ?? null;
}
