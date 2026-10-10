import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import type {
  ActivityEvent,
  ActivityType,
  Client,
  Invoice,
  InvoiceStatus,
  InvoiceWithClient,
  Payout,
  Pot,
  ReminderTone,
} from "@/types/domain";

// ---------- Clients ----------

export function createClient(input: {
  name: string;
  email: string;
  company?: string | null;
  on_time_rate?: number;
  avg_days_late?: number;
}): Client {
  const db = getDb();
  const id = newId("cli");
  db.prepare(
    `INSERT INTO clients (id, name, email, company, on_time_rate, avg_days_late)
     VALUES (@id, @name, @email, @company, @on_time_rate, @avg_days_late)`
  ).run({
    id,
    name: input.name,
    email: input.email,
    company: input.company ?? null,
    on_time_rate: input.on_time_rate ?? 1.0,
    avg_days_late: input.avg_days_late ?? 0,
  });
  return getClient(id)!;
}

export function getClient(id: string): Client | undefined {
  return getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(id) as Client | undefined;
}

export function listClients(): Client[] {
  return getDb().prepare(`SELECT * FROM clients ORDER BY name ASC`).all() as Client[];
}

// ---------- Invoices ----------

export function createInvoice(input: {
  client_id: string;
  number: string;
  description: string;
  amount_cents: number;
  currency?: string;
  status?: InvoiceStatus;
  issued_date: string;
  due_date: string;
  paid_date?: string | null;
}): Invoice {
  const db = getDb();
  const id = newId("inv");
  db.prepare(
    `INSERT INTO invoices
      (id, client_id, number, description, amount_cents, currency, status, issued_date, due_date, paid_date)
     VALUES
      (@id, @client_id, @number, @description, @amount_cents, @currency, @status, @issued_date, @due_date, @paid_date)`
  ).run({
    id,
    client_id: input.client_id,
    number: input.number,
    description: input.description,
    amount_cents: input.amount_cents,
    currency: input.currency ?? "USD",
    status: input.status ?? "SENT",
    issued_date: input.issued_date,
    due_date: input.due_date,
    paid_date: input.paid_date ?? null,
  });
  return getInvoice(id)!;
}

export function getInvoice(id: string): Invoice | undefined {
  return getDb().prepare(`SELECT * FROM invoices WHERE id = ?`).get(id) as Invoice | undefined;
}

export function listInvoices(): InvoiceWithClient[] {
  return getDb()
    .prepare(
      `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company
       FROM invoices i JOIN clients c ON c.id = i.client_id
       ORDER BY i.due_date ASC`
    )
    .all() as InvoiceWithClient[];
}

export function listOpenInvoices(): InvoiceWithClient[] {
  return getDb()
    .prepare(
      `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company
       FROM invoices i JOIN clients c ON c.id = i.client_id
       WHERE i.status NOT IN ('PAID', 'CANCELLED')
       ORDER BY i.due_date ASC`
    )
    .all() as InvoiceWithClient[];
}

export function updateInvoice(
  id: string,
  patch: Partial<
    Pick<
      Invoice,
      | "status"
      | "paypal_invoice_id"
      | "paypal_invoice_number"
      | "risk_score"
      | "risk_rationale"
      | "discount_offered_pct"
      | "discount_expires_at"
      | "last_reminder_tone"
      | "paid_date"
    >
  > & { incrementReminder?: boolean }
): Invoice {
  const db = getDb();
  const current = getInvoice(id);
  if (!current) throw new Error(`invoice ${id} not found`);

  const next = {
    status: patch.status ?? current.status,
    paypal_invoice_id: patch.paypal_invoice_id ?? current.paypal_invoice_id,
    paypal_invoice_number: patch.paypal_invoice_number ?? current.paypal_invoice_number,
    risk_score: patch.risk_score ?? current.risk_score,
    risk_rationale: patch.risk_rationale ?? current.risk_rationale,
    discount_offered_pct: patch.discount_offered_pct ?? current.discount_offered_pct,
    discount_expires_at: patch.discount_expires_at ?? current.discount_expires_at,
    last_reminder_tone: (patch.last_reminder_tone ?? current.last_reminder_tone) as ReminderTone | null,
    paid_date: patch.paid_date ?? current.paid_date,
    reminder_count: patch.incrementReminder ? current.reminder_count + 1 : current.reminder_count,
  };

  db.prepare(
    `UPDATE invoices SET
       status = @status,
       paypal_invoice_id = @paypal_invoice_id,
       paypal_invoice_number = @paypal_invoice_number,
       risk_score = @risk_score,
       risk_rationale = @risk_rationale,
       discount_offered_pct = @discount_offered_pct,
       discount_expires_at = @discount_expires_at,
       last_reminder_tone = @last_reminder_tone,
       paid_date = @paid_date,
       reminder_count = @reminder_count,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({ id, ...next });

  return getInvoice(id)!;
}

// ---------- Pots ----------

export function listPots(): Pot[] {
  return getDb().prepare(`SELECT * FROM pots ORDER BY allocation_pct DESC`).all() as Pot[];
}

export function upsertPot(input: {
  key: string;
  name: string;
  allocation_pct: number;
  paypal_payout_receiver: string;
  color: string;
}): Pot {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM pots WHERE key = ?`).get(input.key) as Pot | undefined;
  if (existing) {
    db.prepare(
      `UPDATE pots SET name = @name, allocation_pct = @allocation_pct, paypal_payout_receiver = @paypal_payout_receiver, color = @color WHERE key = @key`
    ).run(input);
    return db.prepare(`SELECT * FROM pots WHERE key = ?`).get(input.key) as Pot;
  }
  const id = newId("pot");
  db.prepare(
    `INSERT INTO pots (id, key, name, allocation_pct, balance_cents, paypal_payout_receiver, color)
     VALUES (@id, @key, @name, @allocation_pct, 0, @paypal_payout_receiver, @color)`
  ).run({ id, ...input });
  return db.prepare(`SELECT * FROM pots WHERE id = ?`).get(id) as Pot;
}

export function creditPot(potId: string, amountCents: number): void {
  getDb()
    .prepare(`UPDATE pots SET balance_cents = balance_cents + ? WHERE id = ?`)
    .run(amountCents, potId);
}

export function debitPot(potId: string, amountCents: number): void {
  getDb()
    .prepare(`UPDATE pots SET balance_cents = balance_cents - ? WHERE id = ?`)
    .run(amountCents, potId);
}

// ---------- Payouts ----------

export function createPayout(input: {
  invoice_id: string;
  pot_id: string;
  amount_cents: number;
  paypal_payout_batch_id?: string | null;
  paypal_payout_item_id?: string | null;
  status: Payout["status"];
}): Payout {
  const db = getDb();
  const id = newId("pay");
  db.prepare(
    `INSERT INTO payouts (id, invoice_id, pot_id, amount_cents, paypal_payout_batch_id, paypal_payout_item_id, status)
     VALUES (@id, @invoice_id, @pot_id, @amount_cents, @paypal_payout_batch_id, @paypal_payout_item_id, @status)`
  ).run({
    id,
    invoice_id: input.invoice_id,
    pot_id: input.pot_id,
    amount_cents: input.amount_cents,
    paypal_payout_batch_id: input.paypal_payout_batch_id ?? null,
    paypal_payout_item_id: input.paypal_payout_item_id ?? null,
    status: input.status,
  });
  return db.prepare(`SELECT * FROM payouts WHERE id = ?`).get(id) as Payout;
}

export function listPayouts(): Payout[] {
  return getDb().prepare(`SELECT * FROM payouts ORDER BY created_at DESC`).all() as Payout[];
}

// ---------- Activity log ----------

export function logActivity(input: {
  type: ActivityType;
  client_id?: string | null;
  invoice_id?: string | null;
  summary: string;
  detail?: unknown;
}): ActivityEvent {
  const db = getDb();
  const id = newId("act");
  db.prepare(
    `INSERT INTO agent_activity (id, type, client_id, invoice_id, summary, detail_json)
     VALUES (@id, @type, @client_id, @invoice_id, @summary, @detail_json)`
  ).run({
    id,
    type: input.type,
    client_id: input.client_id ?? null,
    invoice_id: input.invoice_id ?? null,
    summary: input.summary,
    detail_json: input.detail !== undefined ? JSON.stringify(input.detail) : null,
  });
  return db.prepare(`SELECT * FROM agent_activity WHERE id = ?`).get(id) as ActivityEvent;
}

export function listActivity(limit = 200): ActivityEvent[] {
  return getDb()
    .prepare(`SELECT * FROM agent_activity ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as ActivityEvent[];
}

// ---------- Reset (demo convenience) ----------

export function resetAllData(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM agent_activity;
    DELETE FROM payouts;
    DELETE FROM invoices;
    DELETE FROM clients;
    DELETE FROM pots;
  `);
}
