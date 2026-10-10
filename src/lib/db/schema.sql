-- Pocket CFO schema. SQLite, loaded once on first connection.

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  on_time_rate REAL NOT NULL DEFAULT 1.0,   -- historical fraction of invoices paid on/before due date
  avg_days_late REAL NOT NULL DEFAULT 0,    -- historical average days late (0 if always on time)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  number TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | SENT | VIEWED | REMINDED | OVERDUE | DISCOUNT_OFFERED | PAID | CANCELLED
  issued_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_date TEXT,
  paypal_invoice_id TEXT,
  paypal_invoice_number TEXT,
  risk_score REAL,                      -- 0..1 probability of being paid late, set by agent
  risk_rationale TEXT,                  -- short AI/heuristic explanation
  discount_offered_pct REAL,            -- e.g. 0.03 for 3% early-payment discount
  discount_expires_at TEXT,
  last_reminder_tone TEXT,              -- FRIENDLY | FIRM | FINAL
  reminder_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS pots (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,             -- tax | reinvest | take_home | buffer
  name TEXT NOT NULL,
  allocation_pct REAL NOT NULL,         -- share of every incoming payment routed here, sums to 1.0 across pots
  balance_cents INTEGER NOT NULL DEFAULT 0,
  paypal_payout_receiver TEXT NOT NULL, -- sandbox email/receiver this pot pays out to
  color TEXT NOT NULL DEFAULT '#0070ba'
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  pot_id TEXT NOT NULL REFERENCES pots(id),
  amount_cents INTEGER NOT NULL,
  paypal_payout_batch_id TEXT,
  paypal_payout_item_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SUCCESS | FAILED | SIMULATED
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS agent_activity (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,       -- RISK_SCORED | REMINDER_SENT | DISCOUNT_OFFERED | INVOICE_PAID | PAYOUT_SPLIT | CYCLE_STARTED | CYCLE_FINISHED
  client_id TEXT,
  invoice_id TEXT,
  summary TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity(created_at);
