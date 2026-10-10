# Pocket CFO

**An autonomous AI agent that chases invoices, negotiates early payment, and auto-allocates every dollar you collect — through real PayPal APIs.**

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

> Freelancers and small businesses lose real money to two silent problems: invoices that sit unpaid because nobody has time to chase them, and income that arrives and just sits in one account instead of being set aside for tax, reinvested, or protected. Pocket CFO is a background agent that solves both — it doesn't just *tell you* an invoice is risky, it *acts*: drafting and escalating reminders, negotiating early-payment discounts, and the moment cash lands, autonomously splitting it across purpose-built pots via PayPal Payouts.

---

## What it does

1. **Scores every open invoice's payment risk** from the client's historical reliability, how close/overdue the due date is, and how many reminders have already gone unanswered — with a plain-English rationale, not a black-box number.
2. **Decides the right move and executes it**, no human in the loop:
   - Drafts and sends a PayPal invoice for anything still in draft.
   - Negotiates a capped 2–5% early-payment discount on large, at-risk invoices while there's still runway before the due date.
   - Escalates reminders through three tones (friendly → firm → final) via the PayPal Invoicing API's `remind` endpoint.
3. **The moment a payment is captured**, autonomously fires real PayPal Payouts that split the cash across four pots — Tax Reserve, Reinvestment, Emergency Buffer, Take-Home — closing the loop from "got paid" to "money is already where it needs to be," with zero manual transfers.
4. **Shows its work.** Every decision the agent makes is logged to a live activity feed so you can see exactly why it did what it did.

This is the "agentic commerce" bet taken literally: the AI doesn't recommend an action for a human to click — it is the thing initiating the PayPal transaction.

## Why this and not a chatbot bolted onto checkout

Invoice-chasing and cash allocation are both real, provable pain points for the ~70M+ freelancers and small businesses that already use PayPal to get paid, and both are naturally "agentic" — they involve a sequence of autonomous decisions (how risky is this, should I discount, what tone, where should this money go) rather than a single transaction. That made it a good fit for demonstrating genuine agentic commerce rather than AI-flavored UI copy.

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Next.js dashboard   │◄──────┤  SQLite (clients,         │
│  (AG Grid + Recharts) │       │  invoices, pots, payouts,  │
└──────────┬───────────┘        │  agent activity log)      │
           │ REST (/api/*)      └───────────▲────────────────┘
           ▼                                │
┌──────────────────────────────────────────┴───────────────┐
│                     Agent orchestrator                     │
│  risk scoring → discount negotiation → reminder drafting   │
│  → cash-pot allocation          (src/lib/agent/*.ts)        │
└───────┬───────────────────────────────────┬───────────────┘
        │                                   │
        ▼                                   ▼
┌───────────────────┐             ┌────────────────────────┐
│  PayPal Invoicing   │             │   PayPal Payouts API    │
│  API (sandbox)      │             │   (sandbox)              │
│  create/send/remind │             │   split payment → pots   │
└───────────────────┘             └────────────────────────┘
        ▲
        │ webhook (INVOICING.INVOICE.PAID / PAYMENT.CAPTURE.COMPLETED)
        │  — or the one-click "Simulate Payment" dev endpoint
┌───────┴───────────────────────────────────────────────────┐
│     Claude (Anthropic) — optional, graceful fallback        │
│  polishes risk rationale + drafts reminder email copy        │
│  (deterministic heuristics run the actual decisions either way) │
└───────────────────────────────────────────────────────────┘
```

Every PayPal call is wrapped so the app is **fully demoable with zero configuration**: if `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` aren't set, every call returns a realistic, clearly-labeled simulated response instead of failing, so you (or a judge) can see the full agent loop run end-to-end before ever touching the PayPal Developer Dashboard. The same is true for `ANTHROPIC_API_KEY` — every AI-assisted decision has a deterministic fallback, so the agent's *decisions* never depend on an LLM being configured, only the *wording* gets sharper when one is.

## Quickstart

### Prerequisites

- Node.js 20+ and npm
- A [PayPal Developer](https://developer.paypal.com/dashboard/) account (free) — for real sandbox calls. Not required to try the app.

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. (Optional, for real PayPal sandbox calls) Fill in `.env`

1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox) → **Apps & Credentials** → **Sandbox** → create (or use the default) REST API app.
2. Copy the **Client ID** and **Secret** into `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`.
3. Under **Sandbox → Accounts**, grab a sandbox personal account email and put it in `PAYPAL_SANDBOX_PAYOUT_RECEIVER` (used as the default Payouts receiver for all four pots — point `PAYPAL_POT_<KEY>_RECEIVER` env vars at different sandbox emails if you want to see money land in different accounts).

Leave these blank to run entirely in simulated mode — the UI will clearly show a "sandbox not connected" badge.

### 3. (Optional) Add an AI key

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without it, Pocket CFO still makes every decision (risk scores, discount offers, reminder tone) via its deterministic rules engine — you just get template-based copy instead of Claude-polished copy.

### 4. Seed demo data and run

```bash
npm run seed   # loads 4 clients and 6 invoices across every interesting state
npm run dev    # http://localhost:3000
```

Or skip the CLI and just click **Seed demo data** in the dashboard itself.

### 5. Try it

1. Click **Run agent cycle** — watch the activity feed fill with risk scores, a sent invoice, a reminder, and a negotiated discount offer, each a real (or simulated) PayPal API call.
2. Click **Simulate payment** on any open invoice — this stands in for a real PayPal webhook delivery and triggers the exact same `handlePaymentReceived` code path a production webhook would. Watch the pots on the right fill up via real PayPal Payouts calls.
3. Run the cycle again to see risk scores and reminder tone escalate on whatever's still unpaid.

### Going fully live (real webhooks instead of the Simulate button)

Expose your local server (e.g. `ngrok http 3000`), then in the Developer Dashboard add a webhook pointed at `https://<your-tunnel>/api/webhook/paypal`, subscribed to `INVOICING.INVOICE.PAID` and `PAYMENT.CAPTURE.COMPLETED`. Put the webhook's ID into `PAYPAL_WEBHOOK_ID` in `.env` — Pocket CFO will then verify and act on real payment events automatically.

## Project structure

```
src/
  app/                    Next.js App Router pages + API routes
    api/agent/run          POST — runs one autonomous agent cycle
    api/simulate/pay        POST — simulates a payment capture (dev/demo)
    api/webhook/paypal      POST — real PayPal webhook receiver
    api/{invoices,clients,pots,payouts,activity}  GET — dashboard data
  components/             Dashboard UI (AG Grid invoice table, cash-flow
                          chart, pots panel, activity feed)
  lib/agent/              Pure decision logic: risk.ts, discount.ts,
                          reminders.ts, allocation.ts, orchestrator.ts, llm.ts
  lib/paypal/             Invoicing, Payouts, and Webhooks API wrappers
                          (with simulated fallbacks)
  lib/db/                 SQLite schema + typed repository functions
  lib/seed.ts             Demo dataset
scripts/seed.ts           CLI seeding entrypoint
```

## Tools used

- **PayPal Developer Platform** — Invoicing v2 API (create, send, remind), Payouts API (batch payout per pot), Webhooks (invoice-paid / capture-completed events), OAuth2 client-credentials flow. This is the transactional backbone: every autonomous decision the agent makes either creates or updates a real PayPal object.
- **Anthropic Claude** (optional) — polishes risk rationale into a plain-English sentence and drafts/escalates reminder emails in the right tone. Used purely for *language*, never for the underlying financial decision (which is a deterministic, auditable rules engine — see `lib/agent/risk.ts` and `discount.ts`).
- **Next.js 15 (App Router) + TypeScript** — single deployable app serving both the dashboard and the agent's API routes.
- **AG Grid** — the invoice ledger, with inline risk bars, status pills, and a one-click "simulate payment" action per row.
- **Recharts** — projected cash-flow chart, splitting expected vs. risk-weighted-at-risk income by week.
- **better-sqlite3** — zero-setup embedded database for clients, invoices, pots, payouts, and the agent's activity log.
- **Vitest** — unit tests for the three decision engines (risk scoring, discount negotiation, pot allocation) so the "AI" part of this is actually verifiable, not vibes.

## How this maps to the judging criteria

| Criterion | How Pocket CFO addresses it |
|---|---|
| **Technological Implementation** | Real Invoicing + Payouts API calls drive every state transition; a working, tested decision engine (15 unit tests) rather than a thin LLM wrapper. |
| **Design** | One coherent product loop — score → act → collect → allocate — not a grab-bag of unrelated features; dashboard mirrors that loop visually (risk → activity feed → pots). |
| **Potential Impact** | Chasing invoices and allocating cash are universal, provable pain points for PayPal's freelancer/SMB base; the agent closes the loop end-to-end instead of just flagging a problem. |
| **Innovation/Idea** | Goes beyond "AI approves a payment" (the common pattern this cycle) to an agent that *negotiates* (discount offers) and *re-distributes* collected cash autonomously — a new way to get paid, not just a new way to pay. |
| **Presentation** | Narrow, demoable scope: seed → run cycle → simulate payment is a complete, visually rich story in under 3 minutes. |

## Demo video shot list (~2:30)

1. **(0:00–0:20)** Problem statement over the empty dashboard: "Chasing invoices and figuring out where the money should go both eat hours every week."
2. **(0:20–0:45)** Click **Seed demo data** → walk the invoice grid: a comfortably-upcoming invoice, a risky due-soon one, an overdue one, a badly-overdue one already reminded twice, and an unsent draft.
3. **(0:45–1:30)** Click **Run agent cycle** live → narrate the activity feed as it fills: invoice sent via PayPal, risk scored with rationale, discount negotiated on the risky one, reminder escalated to FINAL on the worst one.
4. **(1:30–2:10)** Click **Simulate payment** on the discounted invoice → show the PayPal Payouts firing and the four pots filling in real time; open the PayPal sandbox dashboard briefly to show the real payout batch.
5. **(2:10–2:30)** Close on the cash-flow chart and the one-line pitch: "Pocket CFO doesn't just watch your money — it moves it."

## License

MIT — see [LICENSE](./LICENSE).
