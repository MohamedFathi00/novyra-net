export interface BillingStatusResponse {
  provider: string;
  configured: boolean;
  webhookConfigured: boolean;
  publishableKeySet: boolean;
  emailServiceConfigured: boolean;
}

export interface AdminSystemStatusResponse {
  geminiApiKey: 'configured' | 'missing';
  stripeSecretKey: 'configured' | 'missing';
  stripeWebhookSecret: 'configured' | 'missing';
  stripePublishableKey: 'configured' | 'missing';
  emailServiceApiKey: 'configured' | 'missing';
  appUrlConfigured: boolean;
  paymentProvider: string;
  adminBootstrapEmailConfigured: boolean;
  nodeEnv: string;
}

export async function fetchBillingStatus(): Promise<BillingStatusResponse> {
  const res = await fetch('/api/billing/status');
  if (!res.ok) {
    return {
      provider: 'stripe',
      configured: false,
      webhookConfigured: false,
      publishableKeySet: false,
      emailServiceConfigured: false,
    };
  }
  return res.json();
}

export async function createCheckoutSession(params: {
  idToken: string;
  planId: 'pro' | 'business';
  billingCycle: 'monthly' | 'annual';
  unitAmountCents: number;
  currency: string;
  planName: string;
  couponCode?: string;
}): Promise<{ sessionId: string; url: string }> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      planId: params.planId,
      billingCycle: params.billingCycle,
      unitAmountCents: params.unitAmountCents,
      currency: params.currency,
      planName: params.planName,
      couponCode: params.couponCode,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Checkout request failed.');
  }
  return data;
}

export async function verifyCheckoutSession(sessionId: string, idToken: string): Promise<{
  verified: boolean;
  paymentStatus: string;
  planId: 'free' | 'pro' | 'business';
  billingCycle: 'monthly' | 'annual';
  amountTotal: number;
  currency: string;
}> {
  const res = await fetch(`/api/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Checkout verification failed.');
  }
  return data;
}

export interface VerifiedServerSubscription {
  planId: 'free' | 'pro' | 'business';
  billingCycle: 'monthly' | 'annual';
  status: 'active';
  provider: 'stripe';
  updatedAt: string;
}

export async function fetchMyServerSubscription(
  idToken: string,
): Promise<VerifiedServerSubscription | null> {
  const res = await fetch('/api/billing/my-subscription', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { subscription?: VerifiedServerSubscription | null };
  return data.subscription ?? null;
}

export async function fetchAdminSystemStatus(idToken: string): Promise<AdminSystemStatusResponse> {
  const res = await fetch('/api/admin/system-status', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Admin system status check failed.');
  }
  return data;
}
