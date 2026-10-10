import { newId } from "@/lib/id";
import { paypalConfigured, SIMULATED_PREFIX } from "./env";
import { paypalRequest } from "./client";

export interface PayoutItemInput {
  receiverEmail: string;
  amount: number; // major units
  currency: string;
  note: string;
  senderItemId: string;
}

export interface PayoutResult {
  batchId: string;
  itemId: string;
  simulated: boolean;
  status: string;
}

/**
 * Sends a single-item PayPal Payout (Payouts API). Used by the cash
 * allocation agent to move a share of a collected invoice straight into a
 * pot's sandbox receiver account — this is the "new way to get paid" half
 * of Pocket CFO: money that arrives gets autonomously re-distributed.
 */
export async function sendPayout(input: PayoutItemInput): Promise<PayoutResult> {
  if (!paypalConfigured()) {
    return {
      batchId: `${SIMULATED_PREFIX}${newId("batch")}`,
      itemId: `${SIMULATED_PREFIX}${newId("item")}`,
      simulated: true,
      status: "SIMULATED",
    };
  }

  const res = await paypalRequest<{
    batch_header: { payout_batch_id: string; batch_status: string };
    items: Array<{ payout_item_id: string }>;
  }>("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: {
        sender_batch_id: newId("senderbatch"),
        email_subject: "Pocket CFO moved your money",
        email_message: input.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: input.amount.toFixed(2), currency: input.currency },
          receiver: input.receiverEmail,
          note: input.note,
          sender_item_id: input.senderItemId,
        },
      ],
    },
  });

  return {
    batchId: res.batch_header.payout_batch_id,
    itemId: res.items[0]?.payout_item_id ?? "",
    simulated: false,
    status: res.batch_header.batch_status,
  };
}
