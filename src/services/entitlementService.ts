import type {
  FeatureFlagDoc,
  Language,
  PlanId,
  SubscriptionPlanConfig,
  SubscriptionStatus,
  UserEntitlementDoc,
  UserSubscriptionDoc,
} from '../types/network';

export type GatedFeatureKey =
  | 'cloud_sync'
  | 'unlimited_history'
  | 'advanced_analytics'
  | 'gaming_mode'
  | 'smart_troubleshooting'
  | 'custom_alerts'
  | 'multi_device_tracking'
  | 'team_workspaces'
  | 'admin_dashboard';

export const DEFAULT_PLAN_CATALOG: Record<PlanId, SubscriptionPlanConfig> = {
  free: {
    id: 'free',
    name: 'Free Explorer',
    nameAr: 'الباقة المجانية',
    tagline: 'Essential real-time speed testing & diagnostics',
    taglineAr: 'اختبارات سرعة حقيقية وأدوات تشخيص أساسية',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    currency: 'USD',
    pricingConfigured: true,
    active: true,
    maxHistoryRecords: 20,
    maxSavedDevices: 1,
    maxAiRequestsPerDay: 3,
    maxOrgMembers: 0,
    cloudSyncEnabled: false,
    analyticsEnabled: false,
    gamingModeEnabled: false,
    alertsEnabled: false,
    exportEnabled: true,
    teamManagementEnabled: false,
    features: [
      'Real Download, Upload, Ping, Jitter & Probe Loss tests',
      'Local test history (up to 20 saved records)',
      'Core DNS, Ping, Port & Public IP diagnostics',
      '3 NOVYRA AI Advisor requests / day (signed-in)',
    ],
  },
  pro: {
    id: 'pro',
    name: 'NOVYRA Pro',
    nameAr: 'NOVYRA برو',
    tagline: 'Cloud intelligence, unlimited history, Gaming Mode & alerts',
    taglineAr: 'مزامنة سحابية وسجل غير محدود ووضع الألعاب والتنبيهات الذكية',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    currency: 'USD',
    pricingConfigured: false,
    active: true,
    maxHistoryRecords: -1,
    maxSavedDevices: 10,
    maxAiRequestsPerDay: 50,
    maxOrgMembers: 0,
    cloudSyncEnabled: true,
    analyticsEnabled: true,
    gamingModeEnabled: true,
    alertsEnabled: true,
    exportEnabled: true,
    teamManagementEnabled: false,
    features: [
      'Unlimited cloud-synced test history & backup restore',
      'Gaming Mode Analyzer & Smart Troubleshooting workflow',
      'ISP Performance Tracker & time-of-day stability charts',
      'Custom alert threshold rules & up to 10 registered devices',
      '50 NOVYRA AI Advisor analyses / day',
    ],
  },
  business: {
    id: 'business',
    name: 'NOVYRA Business',
    nameAr: 'NOVYRA للأعمال',
    tagline: 'Multi-user organizations, fleet devices & centralized analytics',
    taglineAr: 'إدارة فرق العمل والأجهزة والتقارير المركزية للمؤسسات',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    currency: 'USD',
    pricingConfigured: false,
    active: true,
    maxHistoryRecords: -1,
    maxSavedDevices: 100,
    maxAiRequestsPerDay: 250,
    maxOrgMembers: 25,
    cloudSyncEnabled: true,
    analyticsEnabled: true,
    gamingModeEnabled: true,
    alertsEnabled: true,
    exportEnabled: true,
    teamManagementEnabled: true,
    features: [
      'Everything in NOVYRA Pro',
      'Organization workspaces with Owner / Admin / Manager / Viewer roles',
      'Up to 25 team members & 100 authorized organization devices',
      'Centralized team telemetry & organization activity audit logs',
      '250 NOVYRA AI Advisor analyses / day',
    ],
  },
};

export const PLAN_FEATURES_AR: Record<PlanId, string[]> = {
  free: [
    'اختبارات حقيقية لسرعة التحميل والرفع و Ping و Jitter ونسبة فقدان النبضات',
    'سجل اختبارات محلي (حتى 20 سجلاً محفوظاً)',
    'أدوات التشخيص الأساسية: فحص DNS و Ping والمنافذ و IP العام',
    '3 استشارات يومية عبر مساعد NOVYRA الذكي (للمستخدمين المسجلين)',
  ],
  pro: [
    'سجل اختبارات سحابي غير محدود مع مزامنة واستعادة النسخ الاحتياطي',
    'محلل وضع الألعاب وسير عمل التشخيص الذكي الموجه',
    'متتبع أداء مزود الخدمة (ISP) ورسوم استقرار الاتصال عبر اليوم',
    'قواعد تنبيه مخصصة وربط حتى 10 أجهزة مسجلة',
    '50 تحليلاً يومياً عبر مستشار NOVYRA الذكي',
  ],
  business: [
    'جميع مزايا باقة NOVYRA برو بالكامل',
    'مساحات عمل للمؤسسات بصلاحيات متعددة (مالك / مسؤول / مدير / مشاهد)',
    'إضافة حتى 25 عضو فريق و 100 جهاز معتمد للمؤسسة',
    'متابعة مركزية لبيانات الفريق وسجلات تدقيق نشاط المؤسسة',
    '250 تحليلاً يومياً عبر مستشار NOVYRA الذكي',
  ],
};

const FEATURE_EN_TO_AR_MAP: Record<string, string> = Object.fromEntries(
  (['free', 'pro', 'business'] as PlanId[]).flatMap((pid) =>
    (DEFAULT_PLAN_CATALOG[pid].features ?? []).map((feat, idx) => [feat, PLAN_FEATURES_AR[pid][idx] ?? feat]),
  ),
);

export function getLocalizedPlanFeatures(plan: SubscriptionPlanConfig, lang: Language): string[] {
  const list = plan.features ?? DEFAULT_PLAN_CATALOG[plan.id]?.features ?? [];
  if (lang !== 'ar') return list;
  const fallbackAr = PLAN_FEATURES_AR[plan.id] ?? [];
  return list.map((item, idx) => FEATURE_EN_TO_AR_MAP[item] ?? fallbackAr[idx] ?? item);
}

export function formatPlanLabel(planId: PlanId, lang: Language): string {
  if (lang !== 'ar') return planId.toUpperCase();
  if (planId === 'business') return 'أعمال';
  if (planId === 'pro') return 'برو';
  return 'مجاني';
}

export function formatSubscriptionStatusLabel(status: SubscriptionStatus | string, lang: Language): string {
  if (lang !== 'ar') return status.toUpperCase();
  switch (status) {
    case 'active':
      return 'نشط';
    case 'trialing':
      return 'فترة تجريبية';
    case 'past_due':
      return 'متأخر السداد';
    case 'canceled':
      return 'ملغى';
    case 'incomplete':
      return 'غير مكتمل';
    case 'none':
    case 'free':
    default:
      return 'الخطة المجانية';
  }
}

export interface ResolvedEntitlements {
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  isAdmin: boolean;
  aiDailyLimit: number;
  maxHistoryRecords: number;
  maxSavedDevices: number;
  cloudSyncEnabled: boolean;
  analyticsEnabled: boolean;
  gamingModeEnabled: boolean;
  alertsEnabled: boolean;
  teamManagementEnabled: boolean;
}

export function getCurrentPlan(params: {
  entitlement: UserEntitlementDoc | null;
  subscription: UserSubscriptionDoc | null;
  isAdmin: boolean;
}): PlanId {
  if (params.entitlement && params.entitlement.status === 'active') {
    return params.entitlement.planId;
  }
  if (
    params.subscription &&
    (params.subscription.status === 'active' || params.subscription.status === 'trialing')
  ) {
    return params.subscription.planId;
  }
  if (params.isAdmin && !params.subscription) return 'business';
  return 'free';
}

export function getSubscriptionStatus(subscription: UserSubscriptionDoc | null): SubscriptionStatus {
  return subscription?.status ?? 'none';
}

export function getUserEntitlements(params: {
  entitlement: UserEntitlementDoc | null;
  subscription: UserSubscriptionDoc | null;
  catalog: Record<PlanId, SubscriptionPlanConfig>;
  isAdmin: boolean;
}): ResolvedEntitlements {
  const planId = getCurrentPlan({
    entitlement: params.entitlement,
    subscription: params.subscription,
    isAdmin: params.isAdmin,
  });
  const plan = params.catalog[planId] ?? DEFAULT_PLAN_CATALOG[planId];
  const subStatus = getSubscriptionStatus(params.subscription);

  if (params.isAdmin && !params.entitlement && !params.subscription) {
    const biz = params.catalog.business ?? DEFAULT_PLAN_CATALOG.business;
    return {
      planId: 'business',
      subscriptionStatus: subStatus === 'none' ? 'active' : subStatus,
      isAdmin: true,
      aiDailyLimit: biz.maxAiRequestsPerDay,
      maxHistoryRecords: -1,
      maxSavedDevices: biz.maxSavedDevices,
      cloudSyncEnabled: true,
      analyticsEnabled: true,
      gamingModeEnabled: true,
      alertsEnabled: true,
      teamManagementEnabled: true,
    };
  }

  return {
    planId,
    subscriptionStatus: params.isAdmin && subStatus === 'none' ? 'active' : subStatus,
    isAdmin: params.isAdmin,
    aiDailyLimit: params.entitlement?.aiDailyLimit ?? plan.maxAiRequestsPerDay,
    maxHistoryRecords: params.entitlement?.maxHistoryRecords ?? plan.maxHistoryRecords,
    maxSavedDevices: params.entitlement?.maxSavedDevices ?? plan.maxSavedDevices,
    cloudSyncEnabled: params.entitlement?.cloudSyncEnabled ?? plan.cloudSyncEnabled,
    analyticsEnabled: params.entitlement?.analyticsEnabled ?? plan.analyticsEnabled,
    gamingModeEnabled: params.entitlement?.gamingModeEnabled ?? plan.gamingModeEnabled,
    alertsEnabled: params.entitlement?.alertsEnabled ?? plan.alertsEnabled,
    teamManagementEnabled: params.entitlement?.teamManagementEnabled ?? plan.teamManagementEnabled,
  };
}

export function canUseFeature(
  feature: GatedFeatureKey,
  resolved: ResolvedEntitlements,
  flags?: Record<string, FeatureFlagDoc>,
): boolean {
  if (feature === 'admin_dashboard') {
    return resolved.isAdmin;
  }

  const flagOverride = flags?.[feature];
  if (flagOverride && !flagOverride.enabled) {
    return resolved.isAdmin;
  }
  if (flagOverride && flagOverride.enabled) {
    if (flagOverride.requiredPlan === 'free') return true;
    if (flagOverride.requiredPlan === 'pro') return resolved.planId === 'pro' || resolved.planId === 'business';
    if (flagOverride.requiredPlan === 'business') return resolved.planId === 'business';
  }

  switch (feature) {
    case 'cloud_sync':
      return resolved.cloudSyncEnabled;
    case 'unlimited_history':
      return resolved.maxHistoryRecords === -1;
    case 'advanced_analytics':
    case 'smart_troubleshooting':
      return resolved.analyticsEnabled;
    case 'gaming_mode':
      return resolved.gamingModeEnabled;
    case 'custom_alerts':
      return resolved.alertsEnabled;
    case 'multi_device_tracking':
      return resolved.maxSavedDevices > 1;
    case 'team_workspaces':
      return resolved.teamManagementEnabled;
    default:
      return false;
  }
}

export function checkUsageLimit(
  currentCount: number,
  maxAllowed: number,
): { allowed: boolean; remaining: number; unlimited: boolean } {
  if (maxAllowed === -1) {
    return { allowed: true, remaining: Infinity, unlimited: true };
  }
  const remaining = Math.max(maxAllowed - currentCount, 0);
  return {
    allowed: currentCount < maxAllowed,
    remaining,
    unlimited: false,
  };
}

export function formatPlanPriceLabel(plan: SubscriptionPlanConfig, cycle: 'monthly' | 'annual', lang: 'en' | 'ar'): string {
  if (plan.id === 'free') {
    return lang === 'ar' ? 'مجاناً للأبد' : '$0 / Free Forever';
  }
  if (!plan.pricingConfigured || (cycle === 'monthly' && plan.monthlyPriceCents <= 0) || (cycle === 'annual' && plan.annualPriceCents <= 0)) {
    return lang === 'ar' ? 'يتطلب تهيئة التسعير من الإدارة' : 'Pricing configuration required';
  }
  const cents = cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
  const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  const period = cycle === 'annual' ? (lang === 'ar' ? '/ سنوياً' : '/ yr') : (lang === 'ar' ? '/ شهرياً' : '/ mo');
  return `${plan.currency} ${amount} ${period}`;
}
