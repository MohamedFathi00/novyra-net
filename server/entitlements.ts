export type PlanTier = 'free' | 'pro' | 'business';

export interface PlanQuotaPolicy {
  id: PlanTier;
  aiDailyLimit: number;
  maxHistoryRecords: number;
  maxSavedDevices: number;
  maxOrgMembers: number;
  cloudSyncEnabled: boolean;
  analyticsEnabled: boolean;
  gamingModeEnabled: boolean;
  alertsEnabled: boolean;
  teamManagementEnabled: boolean;
}

export const DEFAULT_PLAN_POLICIES: Record<PlanTier, PlanQuotaPolicy> = {
  free: {
    id: 'free',
    aiDailyLimit: 3,
    maxHistoryRecords: 20,
    maxSavedDevices: 1,
    maxOrgMembers: 0,
    cloudSyncEnabled: false,
    analyticsEnabled: false,
    gamingModeEnabled: false,
    alertsEnabled: false,
    teamManagementEnabled: false,
  },
  pro: {
    id: 'pro',
    aiDailyLimit: 50,
    maxHistoryRecords: -1,
    maxSavedDevices: 10,
    maxOrgMembers: 0,
    cloudSyncEnabled: true,
    analyticsEnabled: true,
    gamingModeEnabled: true,
    alertsEnabled: true,
    teamManagementEnabled: false,
  },
  business: {
    id: 'business',
    aiDailyLimit: 250,
    maxHistoryRecords: -1,
    maxSavedDevices: 100,
    maxOrgMembers: 25,
    cloudSyncEnabled: true,
    analyticsEnabled: true,
    gamingModeEnabled: true,
    alertsEnabled: true,
    teamManagementEnabled: true,
  },
};

export const GUEST_AI_TRIAL_DAILY_LIMIT = 2;

export interface VerifiedServerSubscription {
  planId: PlanTier;
  billingCycle: 'monthly' | 'annual';
  status: 'active';
  provider: 'stripe';
  updatedAt: string;
}

const verifiedServerPlans = new Map<string, VerifiedServerSubscription>();
const dailyAiUsage = new Map<string, { dateKey: string; used: number }>();

export function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function setVerifiedUserPlan(
  uid: string,
  planId: PlanTier,
  billingCycle: 'monthly' | 'annual' = 'monthly',
): void {
  verifiedServerPlans.set(uid, {
    planId,
    billingCycle,
    status: 'active',
    provider: 'stripe',
    updatedAt: new Date().toISOString(),
  });
}

export function getVerifiedUserSubscription(uid: string): VerifiedServerSubscription | null {
  return verifiedServerPlans.get(uid) ?? null;
}

export function resolveEffectiveServerPlan(uid: string | null, isAdmin: boolean): PlanTier {
  if (isAdmin) return 'business';
  if (uid && verifiedServerPlans.has(uid)) {
    return verifiedServerPlans.get(uid)!.planId;
  }
  return 'free';
}

export function checkAndConsumeAiQuota(params: {
  uid: string | null;
  ipKey: string;
  isAdmin: boolean;
  requestedTierHint?: unknown;
}): {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  planId: PlanTier | 'guest';
  dateKey: string;
} {
  const dateKey = getTodayDateKey();

  if (!params.uid) {
    const storeKey = `guest:${params.ipKey}:${dateKey}`;
    const entry = dailyAiUsage.get(storeKey) ?? { dateKey, used: 0 };
    if (entry.used >= GUEST_AI_TRIAL_DAILY_LIMIT) {
      return {
        allowed: false,
        used: entry.used,
        limit: GUEST_AI_TRIAL_DAILY_LIMIT,
        remaining: 0,
        planId: 'guest',
        dateKey,
      };
    }
    entry.used += 1;
    dailyAiUsage.set(storeKey, entry);
    return {
      allowed: true,
      used: entry.used,
      limit: GUEST_AI_TRIAL_DAILY_LIMIT,
      remaining: Math.max(GUEST_AI_TRIAL_DAILY_LIMIT - entry.used, 0),
      planId: 'guest',
      dateKey,
    };
  }

  const effectivePlan = resolveEffectiveServerPlan(params.uid, params.isAdmin);
  const limit = DEFAULT_PLAN_POLICIES[effectivePlan].aiDailyLimit;
  const storeKey = `user:${params.uid}:${dateKey}`;
  const entry = dailyAiUsage.get(storeKey) ?? { dateKey, used: 0 };

  if (entry.used >= limit) {
    return {
      allowed: false,
      used: entry.used,
      limit,
      remaining: 0,
      planId: effectivePlan,
      dateKey,
    };
  }

  entry.used += 1;
  dailyAiUsage.set(storeKey, entry);
  return {
    allowed: true,
    used: entry.used,
    limit,
    remaining: Math.max(limit - entry.used, 0),
    planId: effectivePlan,
    dateKey,
  };
}

export function getAiQuotaStatus(uid: string | null, ipKey: string, isAdmin: boolean) {
  const dateKey = getTodayDateKey();
  if (!uid) {
    const entry = dailyAiUsage.get(`guest:${ipKey}:${dateKey}`);
    const used = entry?.used ?? 0;
    return {
      planId: 'guest' as const,
      used,
      limit: GUEST_AI_TRIAL_DAILY_LIMIT,
      remaining: Math.max(GUEST_AI_TRIAL_DAILY_LIMIT - used, 0),
      dateKey,
    };
  }
  const planId = resolveEffectiveServerPlan(uid, isAdmin);
  const limit = DEFAULT_PLAN_POLICIES[planId].aiDailyLimit;
  const entry = dailyAiUsage.get(`user:${uid}:${dateKey}`);
  const used = entry?.used ?? 0;
  return {
    planId,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    dateKey,
  };
}
