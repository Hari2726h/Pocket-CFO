export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalApiBase(): string {
  return process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
}

/**
 * Pocket CFO is designed to demo fully even before a judge (or you) has
 * plugged in real PayPal sandbox credentials: every PayPal call below falls
 * back to a realistic simulated response when PAYPAL_CLIENT_ID/SECRET are
 * unset, and every simulated object is tagged so the UI can show a
 * "sandbox not connected — showing simulated response" badge instead of
 * silently lying about what happened.
 */
export const SIMULATED_PREFIX = "SIMULATED-";
