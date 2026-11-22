import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CreditCard,
  Flag,
  Lock,
  RefreshCw,
  ScrollText,
  Server,
  ShieldCheck,
  Tag,
  Ticket,
  Users,
} from 'lucide-react';
import type {
  AuditLogDoc,
  CouponDoc,
  Language,
  PlanId,
  SubscriptionPlanConfig,
  SupportTicketDoc,
  UserProfileDoc,
} from '../types/network';
import { useAuth } from '../context/AuthContext';
import {
  adminCreateCoupon,
  adminFetchAllTickets,
  adminFetchAllUsers,
  adminFetchAuditLogs,
  adminFetchCoupons,
  adminFetchUserPlanMap,
  adminGrantUserPlan,
  adminRespondToTicket,
  adminSaveFeatureFlag,
  adminSavePlanConfig,
  adminToggleCoupon,
  adminUpdateUserStatus,
} from '../services/cloudSyncService';
import {
  fetchAdminSystemStatus,
  type AdminSystemStatusResponse,
} from '../services/billingClientService';
import { formatPlanLabel } from '../services/entitlementService';

type AdminTab =
  | 'overview'
  | 'users'
  | 'plans'
  | 'flags'
  | 'coupons'
  | 'tickets'
  | 'system'
  | 'logs';

interface AdminDashboardViewProps {
  language: Language;
  onNotify: (type: 'success' | 'error' | 'info', title: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  language,
  onNotify,
}) => {
  const isAr = language === 'ar';
  const { user, isAdmin, plansCatalog, featureFlags, refreshBillingAndProfile, getIdToken } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<UserProfileDoc[]>([]);
  const [userPlans, setUserPlans] = useState<Record<string, PlanId>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<CouponDoc[]>([]);
  const [tickets, setTickets] = useState<SupportTicketDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [systemStatus, setSystemStatus] = useState<AdminSystemStatusResponse | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanConfig>(plansCatalog.pro);

  const [flagKey, setFlagKey] = useState('gaming_mode');
  const [flagEnabled, setFlagEnabled] = useState(true);
  const [flagPlan, setFlagPlan] = useState<PlanId>('pro');

  const [couponCode, setCouponCode] = useState('');
  const [couponPct, setCouponPct] = useState(20);
  const [couponPlan, setCouponPlan] = useState<'all' | 'pro' | 'business'>('pro');
  const [couponMaxUses, setCouponMaxUses] = useState(100);

  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const loadAdminData = useCallback(async () => {
    if (!isAdmin || !user) return;
    setLoading(true);
    try {
      const token = await getIdToken();
      const [u, c, t, l, sys] = await Promise.all([
        adminFetchAllUsers(),
        adminFetchCoupons(),
        adminFetchAllTickets(),
        adminFetchAuditLogs(),
        token ? fetchAdminSystemStatus(token) : Promise.resolve(null),
      ]);
      setUsers(u);
      setCoupons(c);
      setTickets(t);
      setAuditLogs(l);
      setSystemStatus(sys);
      const planMap = await adminFetchUserPlanMap(u.map((item) => item.uid));
      setUserPlans(planMap);
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error
          ? err.message
          : isAr
            ? 'تعذر جلب بيانات لوحة الإدارة.'
            : 'Admin fetch error.',
      );
    } finally {
      setLoading(false);
    }
  }, [getIdToken, isAdmin, isAr, onNotify, user]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  if (!isAdmin || !user) {
    return (
      <div className="nv-card p-8 max-w-md mx-auto text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-[#f06478]" />
        <h2 className="font-display text-lg font-bold">
          {isAr ? '403 — الوصول مقيد' : '403 — Access Restricted'}
        </h2>
        <p className="text-xs text-[#5a6099] dark:text-[#9aa0d6]">
          {isAr
            ? 'لوحة الإدارة مقصورة على المسؤولين الموثقين والمصرح لهم فقط.'
            : 'Administrator Console access is restricted strictly to verified platform admins.'}
        </p>
      </div>
    );
  }

  const actorEmail = user.email || '';

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return u.displayName.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#22e06b]" />
            <span>{isAr ? 'لوحة تحكم الإدارة والعمليات' : 'NOVYRA Admin Control Center'}</span>
          </h2>
          <p className="text-xs text-[#5a6099] dark:text-[#9aa0d6] font-mono-tabular mt-0.5">
            {actorEmail}
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadAdminData}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#262a6b] bg-[#0d1033] px-3.5 py-2 text-xs font-bold text-[#eef0ff] hover:border-[#18c8ff]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{isAr ? 'تحديث البيانات' : 'Refresh'}</span>
        </button>
      </div>

      {/* Admin Sub-Tabs */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview', icon: Activity },
            { id: 'users', label: isAr ? 'المستخدمون' : 'Users', icon: Users },
            { id: 'plans', label: isAr ? 'الباقات والأسعار' : 'Plans & Pricing', icon: CreditCard },
            { id: 'flags', label: isAr ? 'أعلام الميزات' : 'Feature Flags', icon: Flag },
            { id: 'coupons', label: isAr ? 'الكوبونات' : 'Coupons', icon: Tag },
            { id: 'tickets', label: isAr ? 'تذاكر الدعم' : 'Support Tickets', icon: Ticket },
            { id: 'system', label: isAr ? 'حالة النظام' : 'System Status', icon: Server },
            { id: 'logs', label: isAr ? 'سجل التدقيق' : 'Audit Logs', icon: ScrollText },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-bold ${
                tab === item.id ? 'nv-btn-primary' : 'border border-[#262a6b] bg-[#0d1033] text-[#cfd3ff]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="nv-card p-5">
            <div className="text-[#5a6099] dark:text-[#9aa0d6]">{isAr ? 'إجمالي المستخدمين' : 'Registered Users'}</div>
            <div className="font-display text-3xl font-bold font-mono-tabular mt-1 text-[#18c8ff]">{users.length}</div>
          </div>
          <div className="nv-card p-5">
            <div className="text-[#5a6099] dark:text-[#9aa0d6]">{isAr ? 'التذاكر المفتوحة' : 'Open Tickets'}</div>
            <div className="font-display text-3xl font-bold font-mono-tabular mt-1 text-[#f5b942]">
              {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
            </div>
          </div>
          <div className="nv-card p-5">
            <div className="text-[#5a6099] dark:text-[#9aa0d6]">{isAr ? 'الكوبونات الفعالة' : 'Active Coupons'}</div>
            <div className="font-display text-3xl font-bold font-mono-tabular mt-1 text-[#22e06b]">
              {coupons.filter((c) => c.active).length}
            </div>
          </div>
          <div className="nv-card p-5">
            <div className="text-[#5a6099] dark:text-[#9aa0d6]">{isAr ? 'سجلات التدقيق' : 'Audit Events'}</div>
            <div className="font-display text-3xl font-bold font-mono-tabular mt-1 text-[#a855f7]">{auditLogs.length}</div>
          </div>
        </div>
      )}

      {/* Users Management */}
      {tab === 'users' && (
        <div className="nv-card p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم أو UID...' : 'Search by display name or UID...'}
              className="w-full max-w-sm rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
            />
            <span className="text-[11px] text-[#9aa0d6]">
              {isAr
                ? 'يمكنك تبديل باقة أي مستخدم (بما في ذلك حسابك للتجربة) مباشرة. حساب الأدمن الحالي محمي من التعليق الذاتي.'
                : 'Switch any user plan (including your own for testing). Your active Admin account is protected from self-suspension.'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#262a6b] text-[#9aa0d6]">
                  <th className="py-2 text-start">{isAr ? 'المستخدم' : 'User'}</th>
                  <th className="py-2 text-start">{isAr ? 'الباقة' : 'Plan'}</th>
                  <th className="py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-2 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262a6b]/40">
                {filteredUsers.map((u) => {
                  const isSelf = u.uid === user.uid;
                  const currentPlan: PlanId = userPlans[u.uid] ?? (isSelf ? 'business' : 'free');
                  const rowBusy = busyKey === u.uid;
                  return (
                    <tr key={u.uid}>
                      <td className="py-3">
                        <div className="font-bold flex items-center gap-2">
                          <span>{u.displayName}</span>
                          {isSelf && (
                            <span className="rounded-md bg-[#18c8ff]/15 border border-[#18c8ff]/35 px-1.5 py-0.5 text-[10px] text-[#18c8ff]">
                              {isAr ? 'أنت · أدمن' : 'You · Admin'}
                            </span>
                          )}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#9aa0d6]">{u.uid}</div>
                      </td>
                      <td className="py-3 font-mono-tabular">
                        <span className="rounded-lg border border-[#262a6b] bg-[#0a0d33] px-2 py-1 font-bold uppercase text-[#18c8ff]">
                          {formatPlanLabel(currentPlan, language)}
                        </span>
                      </td>
                      <td className="py-3 uppercase font-mono-tabular">
                        <span className={u.accountStatus === 'active' ? 'text-[#22e06b] font-bold' : 'text-[#f06478] font-bold'}>
                          {isAr ? (u.accountStatus === 'active' ? 'نشط' : 'موقوف') : u.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 text-end">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {(['free', 'pro', 'business'] as PlanId[]).map((pid) => {
                            const isCurrent = currentPlan === pid;
                            return (
                              <button
                                key={pid}
                                type="button"
                                disabled={rowBusy}
                                onClick={async () => {
                                  setBusyKey(u.uid);
                                  try {
                                    await adminGrantUserPlan({
                                      targetUid: u.uid,
                                      planId: pid,
                                      billingCycle: pid === 'free' ? 'none' : 'monthly',
                                      catalog: plansCatalog,
                                      actorUid: user.uid,
                                      actorEmail,
                                    });
                                    setUserPlans((prev) => ({ ...prev, [u.uid]: pid }));
                                    await Promise.all([
                                      loadAdminData(),
                                      isSelf ? refreshBillingAndProfile() : Promise.resolve(),
                                    ]);
                                    onNotify(
                                      'success',
                                      isAr
                                        ? `تم تحويل باقة ${u.displayName} إلى ${formatPlanLabel(pid, 'ar')}`
                                        : `Switched ${u.displayName} to ${pid.toUpperCase()}`,
                                    );
                                  } catch (err) {
                                    onNotify(
                                      'error',
                                      err instanceof Error
                                        ? err.message
                                        : isAr
                                          ? 'تعذر تبديل الباقة.'
                                          : 'Failed to switch plan.',
                                    );
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                                className={`rounded-lg px-2.5 py-1 font-bold uppercase transition-colors disabled:opacity-50 ${
                                  isCurrent
                                    ? 'nv-btn-primary'
                                    : 'border border-[#262a6b] bg-[#0a0d33] text-[#cfd3ff] hover:border-[#18c8ff]'
                                }`}
                              >
                                {formatPlanLabel(pid, language)}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            disabled={rowBusy || (isSelf && u.accountStatus === 'active')}
                            onClick={async () => {
                              if (isSelf && u.accountStatus === 'active') return;
                              setBusyKey(u.uid);
                              try {
                                const nextStatus = u.accountStatus === 'active' ? 'suspended' : 'active';
                                await adminUpdateUserStatus({
                                  targetUid: u.uid,
                                  accountStatus: nextStatus,
                                  actorUid: user.uid,
                                  actorEmail,
                                });
                                await loadAdminData();
                                onNotify(
                                  'success',
                                  nextStatus === 'suspended'
                                    ? isAr
                                      ? `تم تعليق حساب ${u.displayName}`
                                      : `Suspended ${u.displayName}`
                                    : isAr
                                      ? `تمت استعادة حساب ${u.displayName}`
                                      : `Restored ${u.displayName}`,
                                );
                              } catch (err) {
                                onNotify(
                                  'error',
                                  err instanceof Error
                                    ? err.message
                                    : isAr
                                      ? 'تعذر تحديث حالة الحساب.'
                                      : 'Failed to update user status.',
                                );
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                            className="rounded-lg border border-[#f06478]/40 px-2.5 py-1 font-bold text-[#f06478] disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              isSelf && u.accountStatus === 'active'
                                ? isAr
                                  ? 'حساب الأدمن الحالي محمي من التعليق'
                                  : 'Active Admin account is protected from self-suspension'
                                : undefined
                            }
                          >
                            {isSelf && u.accountStatus === 'active'
                              ? isAr
                                ? 'محمي (أدمن)'
                                : 'Protected'
                              : u.accountStatus === 'active'
                                ? isAr
                                  ? 'تعليق'
                                  : 'Suspend'
                                : isAr
                                  ? 'استعادة'
                                  : 'Restore'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plans Configurator */}
      {tab === 'plans' && (
        <div className="nv-card p-5 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            {(['free', 'pro', 'business'] as PlanId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => setEditingPlan(plansCatalog[pid])}
                className={`rounded-xl px-3.5 py-2 font-bold uppercase ${
                  editingPlan.id === pid ? 'nv-btn-primary' : 'border border-[#262a6b] bg-[#0d1033] text-[#cfd3ff]'
                }`}
              >
                {formatPlanLabel(pid, language)}
              </button>
            ))}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminSavePlanConfig(editingPlan, user.uid, actorEmail);
                await refreshBillingAndProfile();
                onNotify(
                  'success',
                  isAr
                    ? `تم حفظ إعدادات باقة ${formatPlanLabel(editingPlan.id, 'ar')}`
                    : `Saved plan config for ${editingPlan.id.toUpperCase()}`,
                );
              } catch (err) {
                onNotify(
                  'error',
                  err instanceof Error
                    ? err.message
                    : isAr
                      ? 'تعذر حفظ إعدادات الباقة.'
                      : 'Failed to save plan config.',
                );
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'السعر الشهري (بالسنت)' : 'Monthly Price (Cents)'}
              </label>
              <input
                type="number"
                min={0}
                value={editingPlan.monthlyPriceCents}
                onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPriceCents: Number(e.target.value) || 0 })}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
              />
            </div>
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'السعر السنوي (بالسنت)' : 'Annual Price (Cents)'}
              </label>
              <input
                type="number"
                min={0}
                value={editingPlan.annualPriceCents}
                onChange={(e) => setEditingPlan({ ...editingPlan, annualPriceCents: Number(e.target.value) || 0 })}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
              />
            </div>
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'الحصة اليومية للذكاء الاصطناعي' : 'AI Daily Quota'}
              </label>
              <input
                type="number"
                min={0}
                value={editingPlan.maxAiRequestsPerDay}
                onChange={(e) => setEditingPlan({ ...editingPlan, maxAiRequestsPerDay: Number(e.target.value) || 0 })}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
              />
            </div>

            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'حد سجل الاختبارات (-1 غير محدود)' : 'Max History (-1 = Unlimited)'}
              </label>
              <input
                type="number"
                min={-1}
                value={editingPlan.maxHistoryRecords}
                onChange={(e) => setEditingPlan({ ...editingPlan, maxHistoryRecords: Math.max(-1, Number(e.target.value) || 0) })}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
              />
            </div>
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'الحد الأقصى للأجهزة' : 'Max Saved Devices'}
              </label>
              <input
                type="number"
                min={0}
                value={editingPlan.maxSavedDevices}
                onChange={(e) => setEditingPlan({ ...editingPlan, maxSavedDevices: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
              />
            </div>
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'حد أعضاء المؤسسة' : 'Max Team Members'}
              </label>
              <input
                type="number"
                min={0}
                value={editingPlan.maxOrgMembers}
                onChange={(e) => setEditingPlan({ ...editingPlan, maxOrgMembers: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
              />
            </div>

            <div className="sm:col-span-3 flex flex-wrap gap-4 pt-1">
              {(
                [
                  ['cloudSyncEnabled', isAr ? 'المزامنة السحابية' : 'Cloud Sync'],
                  ['analyticsEnabled', isAr ? 'التحليلات المتقدمة' : 'Analytics'],
                  ['gamingModeEnabled', isAr ? 'وضع الألعاب و ISP' : 'Gaming & ISP'],
                  ['alertsEnabled', isAr ? 'التنبيهات المخصصة' : 'Custom Alerts'],
                  ['teamManagementEnabled', isAr ? 'إدارة المؤسسات' : 'Business Orgs'],
                ] as const
              ).map(([fieldKey, label]) => (
                <label key={fieldKey} className="flex items-center gap-2 cursor-pointer text-[#cfd3ff]">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPlan[fieldKey])}
                    onChange={(e) => setEditingPlan({ ...editingPlan, [fieldKey]: e.target.checked })}
                    className="h-4 w-4 accent-[#6555FF]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 sm:col-span-3 cursor-pointer text-[#eef0ff]">
              <input
                type="checkbox"
                checked={editingPlan.pricingConfigured}
                onChange={(e) => setEditingPlan({ ...editingPlan, pricingConfigured: e.target.checked })}
                className="h-4 w-4 accent-[#6555FF]"
              />
              <span>
                {isAr
                  ? 'التسعير مهيأ ومفعّل للعرض العام والدفع المباشر'
                  : 'Pricing configured & enabled for public display / live checkout'}
              </span>
            </label>
            <div>
              <button type="submit" className="rounded-xl nv-btn-primary px-5 py-2.5 font-bold">
                {isAr ? 'حفظ الباقة في Firestore' : 'Save Plan to Firestore'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feature Flags */}
      {tab === 'flags' && (
        <div className="nv-card p-5 space-y-4 text-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await adminSaveFeatureFlag(
                { key: flagKey, enabled: flagEnabled, requiredPlan: flagPlan },
                user.uid,
                actorEmail,
              );
              await refreshBillingAndProfile();
              onNotify(
                'success',
                isAr ? `تم حفظ علم الميزة ${flagKey}.` : `Feature flag ${flagKey} saved.`,
              );
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block mb-1 text-[#5a6099] dark:text-[#9aa0d6]">
                {isAr ? 'مفتاح الميزة' : 'Feature Key'}
              </label>
              <select
                value={flagKey}
                onChange={(e) => setFlagKey(e.target.value)}
                className="w-full rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-2"
              >
                <option value="gaming_mode">{isAr ? 'وضع الألعاب (gaming_mode)' : 'gaming_mode'}</option>
                <option value="cloud_sync">{isAr ? 'المزامنة السحابية (cloud_sync)' : 'cloud_sync'}</option>
                <option value="custom_alerts">{isAr ? 'قواعد التنبيه (custom_alerts)' : 'custom_alerts'}</option>
                <option value="advanced_analytics">{isAr ? 'التحليلات المتقدمة (advanced_analytics)' : 'advanced_analytics'}</option>
                <option value="team_workspaces">{isAr ? 'مساحات الأعمال (team_workspaces)' : 'team_workspaces'}</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-[#5a6099] dark:text-[#9aa0d6]">
                {isAr ? 'الباقة المطلوبة' : 'Required Plan'}
              </label>
              <select
                value={flagPlan}
                onChange={(e) => setFlagPlan(e.target.value as PlanId)}
                className="w-full rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-2"
              >
                <option value="free">{formatPlanLabel('free', language)}</option>
                <option value="pro">{formatPlanLabel('pro', language)}</option>
                <option value="business">{formatPlanLabel('business', language)}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flagEnabled}
                onChange={(e) => setFlagEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#6555FF]"
              />
              <span>{isAr ? 'مفعّل عالمياً' : 'Globally Enabled'}</span>
            </label>
            <button type="submit" className="rounded-xl nv-btn-primary py-2.5 px-4 font-bold">
              {isAr ? 'تحديث العلم' : 'Update Flag'}
            </button>
          </form>

          <div className="space-y-2">
            {Object.values(featureFlags).map((f) => (
              <div key={f.key} className="nv-inner px-3.5 py-2.5 flex justify-between font-mono-tabular">
                <span className="font-bold">{f.key}</span>
                <span>
                  {f.enabled ? (isAr ? 'مفعّل' : 'ENABLED') : isAr ? 'معطّل' : 'DISABLED'} ·{' '}
                  {isAr ? `الحد الأدنى: ${formatPlanLabel(f.requiredPlan, 'ar')}` : `min:${f.requiredPlan}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coupons */}
      {tab === 'coupons' && (
        <div className="nv-card p-5 space-y-4 text-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!couponCode.trim()) return;
              await adminCreateCoupon(
                {
                  code: couponCode.trim().toUpperCase(),
                  discountPercent: couponPct,
                  applicablePlan: couponPlan,
                  active: true,
                  maxUses: couponMaxUses,
                },
                user.uid,
                actorEmail,
              );
              setCouponCode('');
              onNotify('success', isAr ? 'تم إنشاء كود الخصم بنجاح.' : 'Coupon created.');
              await loadAdminData();
            }}
            className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end"
          >
            <input
              type="text"
              required
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder={isAr ? 'كود الخصم (مثال: LAUNCH25)' : 'LAUNCH25'}
              className="rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-2 uppercase font-mono-tabular"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={couponPct}
              onChange={(e) => setCouponPct(Number(e.target.value) || 10)}
              aria-label={isAr ? 'نسبة الخصم' : 'Discount percent'}
              className="rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-2 font-mono-tabular"
            />
            <select
              value={couponPlan}
              onChange={(e) => setCouponPlan(e.target.value as 'all' | 'pro' | 'business')}
              className="rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-2"
            >
              <option value="all">{isAr ? 'جميع الباقات' : 'all'}</option>
              <option value="pro">{formatPlanLabel('pro', language)}</option>
              <option value="business">{formatPlanLabel('business', language)}</option>
            </select>
            <input
              type="number"
              min={1}
              value={couponMaxUses}
              onChange={(e) => setCouponMaxUses(Number(e.target.value) || 10)}
              aria-label={isAr ? 'أقصى عدد استخدام' : 'Max uses'}
              className="rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-2 font-mono-tabular"
            />
            <button type="submit" className="rounded-xl nv-btn-primary py-2.5 px-4 font-bold">
              {isAr ? 'إنشاء كوبون' : 'Create Coupon'}
            </button>
          </form>

          <div className="space-y-2">
            {coupons.map((c) => (
              <div key={c.code} className="nv-inner px-3.5 py-2.5 flex items-center justify-between font-mono-tabular">
                <span>
                  <strong>{c.code}</strong> · {c.discountPercent}% (
                  {c.applicablePlan === 'all'
                    ? isAr
                      ? 'الكل'
                      : 'all'
                    : formatPlanLabel(c.applicablePlan, language)}
                  ) · {c.usedCount}/{c.maxUses}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await adminToggleCoupon(c.code, !c.active, user.uid, actorEmail);
                    await loadAdminData();
                  }}
                  className="rounded-lg border border-[#c4cbf2] dark:border-[#262a6b] px-2.5 py-1 font-bold"
                >
                  {c.active ? (isAr ? 'تعطيل' : 'Disable') : isAr ? 'تفعيل' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tickets Triage */}
      {tab === 'tickets' && (
        <div className="nv-card p-5 space-y-3 text-xs">
          {tickets.map((tkt) => (
            <div key={tkt.id} className="nv-inner p-4 space-y-2">
              <div className="flex justify-between font-bold">
                <span>{tkt.subject}</span>
                <span className="uppercase font-mono-tabular text-[#18c8ff]">
                  {isAr
                    ? tkt.status === 'open'
                      ? 'مفتوحة'
                      : tkt.status === 'in_progress'
                        ? 'قيد المعالجة'
                        : tkt.status === 'resolved'
                          ? 'تم الحل'
                          : 'مغلقة'
                    : tkt.status}
                </span>
              </div>
              <p className="text-[#4c538c] dark:text-[#cfd3ff]">{tkt.message}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <input
                  type="text"
                  value={replyMap[tkt.id] ?? tkt.adminResponse ?? ''}
                  onChange={(e) => setReplyMap((p) => ({ ...p, [tkt.id]: e.target.value }))}
                  placeholder={isAr ? 'اكتب رد الإدارة...' : 'Write admin response...'}
                  className="flex-1 min-w-[200px] rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#0a0d33] px-3 py-1.5"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await adminRespondToTicket({
                      ticketId: tkt.id,
                      status: 'resolved',
                      adminResponse:
                        replyMap[tkt.id] ??
                        tkt.adminResponse ??
                        (isAr ? 'تمت المعالجة والحل بواسطة الدعم الفني.' : 'Resolved by support.'),
                      actorUid: user.uid,
                      actorEmail,
                    });
                    onNotify('success', isAr ? 'تم تحديث التذكرة بنجاح.' : 'Ticket updated.');
                    await loadAdminData();
                  }}
                  className="rounded-xl nv-btn-primary px-3.5 py-1.5 font-bold"
                >
                  {isAr ? 'حل وإرسال الرد' : 'Resolve & Reply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Masked System Status */}
      {tab === 'system' && (
        <div className="nv-card p-5 space-y-3 text-xs">
          <h3 className="font-display text-sm font-bold">
            {isAr ? 'حالة تهيئة مفاتيح الخادم (مخفية القيم)' : 'Server Environment Status (Secrets Masked)'}
          </h3>
          {systemStatus && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono-tabular">
              {Object.entries(systemStatus).map(([key, val]) => {
                const isConfigured = val === 'configured' || val === true;
                const displayVal = isAr
                  ? val === 'configured' || val === true
                    ? 'مهيأ وجاهز'
                    : val === 'missing' || val === false
                      ? 'غير مهيأ'
                      : String(val)
                  : String(val);
                return (
                  <div key={key} className="nv-inner px-3.5 py-2.5 flex justify-between">
                    <span>{key}</span>
                    <span className={isConfigured ? 'text-[#22e06b] font-bold' : 'text-[#f5b942] font-bold'}>
                      {displayVal}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audit Logs */}
      {tab === 'logs' && (
        <div className="nv-card p-5 space-y-2 text-xs font-mono-tabular">
          {auditLogs.map((log) => (
            <div key={log.id} className="nv-inner px-3.5 py-2.5 flex flex-wrap justify-between gap-2">
              <span>
                <strong className="text-[#18c8ff]">{log.action}</strong> · {log.summary}
              </span>
              <span className="text-[#5a6099] dark:text-[#9aa0d6]">
                {log.actorEmail || log.actorId}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
