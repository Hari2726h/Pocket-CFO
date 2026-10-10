export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "REMINDED"
  | "OVERDUE"
  | "DISCOUNT_OFFERED"
  | "PAID"
  | "CANCELLED";

export type ReminderTone = "FRIENDLY" | "FIRM" | "FINAL";

export type ActivityType =
  | "RISK_SCORED"
  | "REMINDER_SENT"
  | "DISCOUNT_OFFERED"
  | "INVOICE_PAID"
  | "PAYOUT_SPLIT"
  | "CYCLE_STARTED"
  | "CYCLE_FINISHED";

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string | null;
  on_time_rate: number;
  avg_days_late: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  number: string;
  description: string;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  issued_date: string;
  due_date: string;
  paid_date: string | null;
  paypal_invoice_id: string | null;
  paypal_invoice_number: string | null;
  risk_score: number | null;
  risk_rationale: string | null;
  discount_offered_pct: number | null;
  discount_expires_at: string | null;
  last_reminder_tone: ReminderTone | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithClient extends Invoice {
  client_name: string;
  client_email: string;
  client_company: string | null;
}

export interface Pot {
  id: string;
  key: string;
  name: string;
  allocation_pct: number;
  balance_cents: number;
  paypal_payout_receiver: string;
  color: string;
}

export interface Payout {
  id: string;
  invoice_id: string;
  pot_id: string;
  amount_cents: number;
  paypal_payout_batch_id: string | null;
  paypal_payout_item_id: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED" | "SIMULATED";
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  client_id: string | null;
  invoice_id: string | null;
  summary: string;
  detail_json: string | null;
  created_at: string;
}
