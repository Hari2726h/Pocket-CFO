import { paypalConfigured } from "./env";
import { paypalRequest } from "./client";

export interface WebhookVerificationInput {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
  webhookEvent: unknown;
}

/**
 * Verifies an inbound PayPal webhook using PayPal's own verification
 * endpoint. If sandbox credentials or a webhook ID aren't configured, this
 * is skipped and the caller should only trust requests from the
 * /api/simulate/pay dev endpoint instead.
 */
export async function verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean> {
  if (!paypalConfigured() || !input.webhookId) return false;

  const result = await paypalRequest<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        transmission_id: input.transmissionId,
        transmission_time: input.transmissionTime,
        cert_url: input.certUrl,
        auth_algo: input.authAlgo,
        transmission_sig: input.transmissionSig,
        webhook_id: input.webhookId,
        webhook_event: input.webhookEvent,
      },
    }
  );

  return result.verification_status === "SUCCESS";
}

export function paypalWebhooksEnabled(): boolean {
  return paypalConfigured() && Boolean(process.env.PAYPAL_WEBHOOK_ID);
}
