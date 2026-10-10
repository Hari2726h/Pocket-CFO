import { paypalApiBase, paypalConfigured } from "./env";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function fetchAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface PayPalRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class PayPalNotConfiguredError extends Error {
  constructor() {
    super("PayPal sandbox credentials are not configured");
    this.name = "PayPalNotConfiguredError";
  }
}

/** Low-level authenticated PayPal REST call. Throws PayPalNotConfiguredError
 *  if no credentials are present — callers should catch this and use a
 *  simulated fallback (see lib/paypal/invoicing.ts and payouts.ts). */
export async function paypalRequest<T>(path: string, opts: PayPalRequestOptions = {}): Promise<T> {
  if (!paypalConfigured()) {
    throw new PayPalNotConfiguredError();
  }

  const token = await fetchAccessToken();
  const res = await fetch(`${paypalApiBase()}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": crypto.randomUUID(),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new Error(`PayPal API ${opts.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }

  return json as T;
}

/** Some PayPal endpoints (e.g. invoice send) respond 202 with a Location
 *  header pointing at the created/updated resource instead of a body. */
export async function paypalRequestWithLocation(
  path: string,
  opts: PayPalRequestOptions = {}
): Promise<{ location: string | null }> {
  if (!paypalConfigured()) {
    throw new PayPalNotConfiguredError();
  }
  const token = await fetchAccessToken();
  const res = await fetch(`${paypalApiBase()}${path}`, {
    method: opts.method ?? "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal API ${opts.method ?? "POST"} ${path} failed (${res.status}): ${text}`);
  }
  return { location: res.headers.get("location") };
}
