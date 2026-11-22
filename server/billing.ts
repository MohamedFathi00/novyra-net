import crypto from 'node:crypto';
import { setVerifiedUserPlan, type PlanTier } from './entitlements.ts';

const processedWebhookEvents = new Set<string>();

function getStripeSecretKey(): string | null {
  const raw = process.env.STRIPE_SECRET_KEY?.trim();
  return raw && raw.length > 10 && !raw.includes('MY_') ? raw : null;
}

function getStripeWebhookSecret(): string | null {
  const raw = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return raw && raw.length > 8 && !raw.includes('MY_') ? raw : null;
}

export function isPaymentConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

export function isWebhookConfigured(): boolean {
  return Boolean(getStripeWebhookSecret());
}

export function getPublicBillingSummary() {
  return {
    provider: process.env.PAYMENT_PROVIDER || 'stripe',
    configured: isPaymentConfigured(),
    webhookConfigured: isWebhookConfigured(),
    publishableKeySet: Boolean(process.env.STRIPE_PUBLISHABLE_KEY?.trim()),
    emailServiceConfigured: Boolean(process.env.EMAIL_SERVICE_API_KEY?.trim()),
  };
}

export function getAdminSystemStatus(aiConfigured: boolean) {
  return {
    geminiApiKey: aiConfigured ? 'configured' : 'missing',
    stripeSecretKey: getStripeSecretKey() ? 'configured' : 'missing',
    stripeWebhookSecret: getStripeWebhookSecret() ? 'configured' : 'missing',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim() ? 'configured' : 'missing',
    emailServiceApiKey: process.env.EMAIL_SERVICE_API_KEY?.trim() ? 'configured' : 'missing',
    appUrlConfigured: Boolean(process.env.APP_URL?.trim()),
    paymentProvider: process.env.PAYMENT_PROVIDER || 'stripe',
    adminBootstrapEmailConfigured: true,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

export async function createStripeCheckoutSession(params: {
  uid: string;
  email: string;
  planId: 'pro' | 'business';
  billingCycle: 'monthly' | 'annual';
  unitAmountCents: number;
  currency: string;
  planName: string;
  appUrl: string;
  couponCode?: string;
}): Promise<{ sessionId: string; url: string }> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  if (!Number.isInteger(params.unitAmountCents) || params.unitAmountCents < 50) {
    throw new Error('PLAN_PRICING_NOT_CONFIGURED');
  }

  const baseUrl = params.appUrl.replace(/\/$/, '');
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('client_reference_id', params.uid);
  body.set('customer_email', params.email);
  body.set('success_url', `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set('cancel_url', `${baseUrl}/?checkout=cancelled`);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', params.currency.toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(params.unitAmountCents));
  body.set('line_items[0][price_data][recurring][interval]', params.billingCycle === 'annual' ? 'year' : 'month');
  body.set('line_items[0][price_data][product_data][name]', `NOVYRA Net ${params.planName}`);
  body.set('metadata[uid]', params.uid);
  body.set('metadata[planId]', params.planId);
  body.set('metadata[billingCycle]', params.billingCycle);
  if (params.couponCode) {
    body.set('metadata[couponCode]', params.couponCode.slice(0, 40));
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = (await response.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.id || !payload.url) {
    throw new Error(payload.error?.message || 'Stripe Checkout creation failed.');
  }

  return {
    sessionId: payload.id,
    url: payload.url,
  };
}

export async function verifyStripeCheckoutSession(sessionId: string, uid: string): Promise<{
  verified: boolean;
  paymentStatus: string;
  planId: PlanTier;
  billingCycle: 'monthly' | 'annual';
  amountTotal: number;
  currency: string;
  subscriptionId: string | null;
  customerId: string | null;
}> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );
  const data = (await response.json()) as {
    client_reference_id?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    subscription?: string;
    customer?: string;
    metadata?: Record<string, string>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || 'Unable to verify Stripe Checkout session.');
  }

  if (data.client_reference_id !== uid && data.metadata?.uid !== uid) {
    throw new Error('Checkout session does not belong to authenticated user.');
  }

  const planId: PlanTier =
    data.metadata?.planId === 'business'
      ? 'business'
      : data.metadata?.planId === 'pro'
        ? 'pro'
        : 'free';
  const billingCycle = data.metadata?.billingCycle === 'annual' ? 'annual' : 'monthly';
  const verified = data.payment_status === 'paid';

  if (verified && planId !== 'free') {
    setVerifiedUserPlan(uid, planId, billingCycle);
  }

  return {
    verified,
    paymentStatus: data.payment_status || 'unknown',
    planId,
    billingCycle,
    amountTotal: typeof data.amount_total === 'number' ? data.amount_total : 0,
    currency: (data.currency || 'usd').toUpperCase(),
    subscriptionId: typeof data.subscription === 'string' ? data.subscription : null,
    customerId: typeof data.customer === 'string' ? data.customer : null,
  };
}

export function verifyStripeWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): {
  valid: boolean;
  reason?: string;
} {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    return { valid: false, reason: 'STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'MISSING_STRIPE_SIGNATURE' };
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestamp = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(timestamp) || !v1) {
    return { valid: false, reason: 'MALFORMED_SIGNATURE_HEADER' };
  }

  // Reject signatures older than 5 minutes to prevent replay attacks
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > 300) {
    return { valid: false, reason: 'SIGNATURE_EXPIRED' };
  }

  const signedPayload = `${timestamp}.${rawBody.toString('utf-8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }

  const match = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  return match ? { valid: true } : { valid: false, reason: 'SIGNATURE_MISMATCH' };
}

export function markWebhookEventIfNew(eventId: string): boolean {
  if (!eventId || processedWebhookEvents.has(eventId)) {
    return false;
  }
  processedWebhookEvents.add(eventId);
  if (processedWebhookEvents.size > 5000) {
    const first = processedWebhookEvents.values().next().value;
    if (first) processedWebhookEvents.delete(first);
  }
  return true;
}
