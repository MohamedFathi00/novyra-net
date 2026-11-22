import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Check,
  Cloud,
  CloudUpload,
  Cpu,
  CreditCard,
  KeyRound,
  Laptop,
  LayoutDashboard,
  LogOut,
  Plus,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { AuthViews, type AuthViewMode } from './AuthViews';
import type {
  ConnectionInfo,
  Language,
  MonitoringSnapshotDoc,
  PaymentRecordDoc,
  SpeedTestResult,
  UserDeviceDoc,
} from '../types/network';
import { useAuth } from '../context/AuthContext';
import {
  deleteUserDevice,
  fetchCloudTestHistory,
  fetchMonitoringSnapshots,
  fetchUserDevices,
  fetchUserPayments,
  saveUserDevice,
  syncLocalHistoryToCloud,
  updateUserProfileFields,
} from '../services/cloudSyncService';
import {
  canUseFeature,
  checkUsageLimit,
  formatPlanLabel,
  formatSubscriptionStatusLabel,
  getLocalizedPlanFeatures,
} from '../services/entitlementService';

type AccountTab = 'overview' | 'subscription' | 'billing' | 'devices' | 'cloud' | 'security';

interface AccountDashboardViewProps {
  language: Language;
  localHistory: SpeedTestResult[];
  connectionInfo: ConnectionInfo;
  initialAuthMode?: AuthViewMode;
  onAuthComplete?: () => void;
  onOpenLegal: (tab: 'terms' | 'privacy') => void;
  onMergeCloudHistory: (records: SpeedTestResult[]) => void;
  onGoToPricing: () => void;
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const AccountDashboardView: React.FC<AccountDashboardViewProps> = ({
  language,
  localHistory,
  connectionInfo,
  initialAuthMode = 'login',
  onAuthComplete,
  onOpenLegal,
  onMergeCloudHistory,
  onGoToPricing,
  onNotify,
}) => {
  const isAr = language === 'ar';
  const {
    user,
    emailVerified,
    profile,
    privateInfo,
    subscription,
    entitlements,
    plansCatalog,
    featureFlags,
    logout,
    changePassword,
    deleteAccountSafely,
    refreshBillingAndProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AccountTab>('overview');
  const [devices, setDevices] = useState<UserDeviceDoc[]>([]);
  const [payments, setPayments] = useState<PaymentRecordDoc[]>([]);
  const [snapshots, setSnapshots] = useState<MonitoringSnapshotDoc[]>([]);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [displayNameInput, setDisplayNameInput] = useState(profile?.displayName || '');
  const [countryInput, setCountryInput] = useState(privateInfo?.country || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<UserDeviceDoc['deviceType']>('laptop');

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');

  useEffect(() => {
    setDisplayNameInput(profile?.displayName || user?.displayName || '');
    setCountryInput(privateInfo?.country || '');
  }, [privateInfo?.country, profile?.displayName, user?.displayName]);

  const loadAccountCollections = useCallback(async () => {
    if (!user || !emailVerified) return;
    try {
      const [devs, pays, cloudHist, snaps] = await Promise.all([
        fetchUserDevices(user.uid),
        fetchUserPayments(user.uid),
        fetchCloudTestHistory(user.uid, 200),
        fetchMonitoringSnapshots(user.uid, 10).catch(() => []),
      ]);
      setDevices(devs);
      setPayments(pays);
      setCloudCount(cloudHist.length);
      setSnapshots(snaps);
    } catch {
      // Errors handled via structured handler
    }
  }, [emailVerified, user]);

  useEffect(() => {
    loadAccountCollections();
  }, [loadAccountCollections]);

  if (!user || !emailVerified) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#eef0ff]">
            {isAr ? 'حسابك الشخصي والمزامنة السحابية' : 'Account, Cloud Sync & Devices'}
          </h2>
          <p className="text-xs text-[#cfd3ff] mt-0.5">
            {isAr
              ? 'سجّل الدخول أو أنشئ حسابك داخل التطبيق لتفعيل المزامنة السحابية والأجهزة والاشتراكات.'
              : 'Sign in or create your NOVYRA account directly inside the app to enable cloud sync, devices, and subscriptions.'}
          </p>
        </div>
        <AuthViews
          language={language}
          initialMode={initialAuthMode}
          onSuccess={() => {
            onAuthComplete?.();
          }}
          onOpenLegal={onOpenLegal}
        />
      </div>
    );
  }

  const cloudEnabled = canUseFeature('cloud_sync', entitlements, featureFlags);
  const deviceLimit = checkUsageLimit(devices.length, entitlements.maxSavedDevices);
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  const activePlanConfig = plansCatalog[entitlements.planId];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateUserProfileFields(user.uid, {
        displayName: displayNameInput.trim() || 'NOVYRA User',
        country: countryInput.trim(),
      });
      await refreshBillingAndProfile();
      onNotify('success', isAr ? 'تم تحديث بيانات الحساب' : 'Profile updated');
    } catch (err) {
      onNotify('error', isAr ? 'تعذر التحديث' : 'Update failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    if (!deviceLimit.allowed) {
      onNotify(
        'warning',
        isAr ? 'تم بلوغ الحد الأقصى للأجهزة' : 'Device limit reached',
        isAr ? 'قم بالترقية لإضافة أجهزة إضافية.' : 'Upgrade your subscription to register more devices.',
      );
      return;
    }
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await saveUserDevice(user.uid, {
      id,
      name: newDeviceName.trim(),
      deviceType: newDeviceType,
      browserLabel: navigator.userAgent.slice(0, 80),
      isp: connectionInfo.isp || undefined,
      connectionType: connectionInfo.connectionType || connectionInfo.effectiveType || undefined,
    });
    setNewDeviceName('');
    onNotify('success', isAr ? 'تم تسجيل الجهاز بنجاح' : 'Device registered');
    await loadAccountCollections();
  };

  const handleMigrateToCloud = async () => {
    if (!cloudEnabled) {
      onGoToPricing();
      return;
    }
    setSyncing(true);
    try {
      const uploaded = await syncLocalHistoryToCloud(user.uid, localHistory);
      const cloudRecords = await fetchCloudTestHistory(user.uid, 200);
      setCloudCount(cloudRecords.length);
      onMergeCloudHistory(cloudRecords);
      onNotify(
        'success',
        isAr ? 'اكتملت المزامنة السحابية' : 'Cloud Sync Completed',
        isAr
          ? `تم رفع ${uploaded} سجل جديد. الإجمالي السحابي: ${cloudRecords.length}`
          : `Uploaded ${uploaded} local record(s). Total cloud records: ${cloudRecords.length}`,
      );
    } catch (err) {
      onNotify('error', isAr ? 'فشل المزامنة' : 'Sync Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSyncing(false);
    }
  };

  const tabs: Array<{ id: AccountTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview', icon: LayoutDashboard },
    { id: 'subscription', label: isAr ? 'اشتراكي' : 'My Subscription', icon: CreditCard },
    { id: 'billing', label: isAr ? 'سجل الفواتير' : 'Billing History', icon: Receipt },
    { id: 'devices', label: isAr ? 'أجهزتي' : 'My Devices', icon: Laptop },
    { id: 'cloud', label: isAr ? 'البيانات السحابية' : 'Cloud Data', icon: Cloud },
    { id: 'security', label: isAr ? 'الملف والأمان' : 'Profile & Security', icon: KeyRound },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#eef0ff]">
            {isAr ? 'حسابي وإدارة الاشتراك' : 'My Account & Cloud Vault'}
          </h2>
          <p className="text-xs text-[#9aa0d6] font-mono-tabular mt-0.5">
            {user.email} · {formatPlanLabel(entitlements.planId, language)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#f06478]/40 bg-[#f06478]/10 px-3.5 py-2 text-xs font-bold text-[#f06478]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
        </button>
      </div>

      {/* Section Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 text-xs">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-bold transition-colors ${
                active
                  ? 'nv-btn-primary'
                  : 'border border-[#262a6b] bg-[#0d1033] text-[#cfd3ff] hover:border-[#18c8ff]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'الباقة الحالية' : 'Active Plan'}</div>
              <div className="font-display text-xl font-bold text-[#18c8ff] mt-1">
                {formatPlanLabel(entitlements.planId, language)}
              </div>
              <div className="text-[11px] text-[#cfd3ff] mt-0.5">
                {formatSubscriptionStatusLabel(subscription?.status || 'none', language)}
              </div>
            </div>

            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'الحصة اليومية للـ AI' : 'AI Daily Quota'}</div>
              <div className="font-display text-xl font-bold font-mono-tabular text-[#a855f7] mt-1">
                {entitlements.aiDailyLimit} {isAr ? '/ يوم' : '/ day'}
              </div>
            </div>

            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'الاختبارات (محلي / سحابي)' : 'Tests (Local / Cloud)'}</div>
              <div className="font-display text-xl font-bold font-mono-tabular text-[#22e06b] mt-1">
                {localHistory.length} / {cloudCount ?? '—'}
              </div>
            </div>

            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'الأجهزة المسجلة' : 'Registered Devices'}</div>
              <div className="font-display text-xl font-bold font-mono-tabular text-[#eef0ff] mt-1">
                {devices.length} / {entitlements.maxSavedDevices}
              </div>
            </div>
          </div>

          <div className="nv-card p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-display text-sm font-bold text-[#eef0ff]">
                {isAr ? `مرحباً، ${profile?.displayName || user.displayName || 'مستخدم NOVYRA'}` : `Welcome, ${profile?.displayName || user.displayName || 'NOVYRA User'}`}
              </div>
              <p className="text-[#9aa0d6]">
                {cloudEnabled
                  ? isAr
                    ? 'حسابك مهيأ للمزامنة السحابية الفورية وحفظ لقطات الاستقرار والأجهزة.'
                    : 'Your account is enabled for cloud backup, stability snapshots, and multi-device sync.'
                  : isAr
                    ? 'يمكنك الترقية في أي وقت لفتح المزامنة السحابية غير المحدودة ووضع الألعاب.'
                    : 'Upgrade anytime to unlock unlimited cloud sync, Gaming Mode, and custom alert rules.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleMigrateToCloud}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-xl nv-btn-primary px-4 py-2 font-bold disabled:opacity-50"
              >
                {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                <span>
                  {cloudEnabled
                    ? isAr
                      ? 'مزامنة السحابة الآن'
                      : 'Sync Cloud Now'
                    : isAr
                      ? 'استكشاف الباقات'
                      : 'Explore Plans'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: My Subscription */}
      {activeTab === 'subscription' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <div className="nv-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#18c8ff]" />
                <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                  {isAr ? 'تفاصيل الاشتراك والصلاحيات' : 'Subscription & Entitlements'}
                </h3>
              </div>
              <span className="rounded-lg bg-[#6555FF]/20 border border-[#7a6bff]/40 px-2.5 py-0.5 text-[11px] font-bold uppercase text-[#18c8ff]">
                {formatPlanLabel(entitlements.planId, language)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono-tabular">
              <div className="nv-inner p-3">
                <div className="text-[#9aa0d6] font-sans">{isAr ? 'الحالة' : 'Status'}</div>
                <div className="font-bold mt-0.5 uppercase text-[#eef0ff]">
                  {formatSubscriptionStatusLabel(subscription?.status || 'none', language)}
                </div>
              </div>
              <div className="nv-inner p-3">
                <div className="text-[#9aa0d6] font-sans">{isAr ? 'سجل الاختبارات' : 'History Limit'}</div>
                <div className="font-bold mt-0.5 text-[#eef0ff]">
                  {entitlements.maxHistoryRecords === -1
                    ? isAr
                      ? 'غير محدود'
                      : 'Unlimited'
                    : entitlements.maxHistoryRecords}
                </div>
              </div>
              <div className="nv-inner p-3">
                <div className="text-[#9aa0d6] font-sans">{isAr ? 'الأجهزة المتاحة' : 'Device Quota'}</div>
                <div className="font-bold mt-0.5 text-[#eef0ff]">{entitlements.maxSavedDevices}</div>
              </div>
              <div className="nv-inner p-3">
                <div className="text-[#9aa0d6] font-sans">{isAr ? 'حصة AI اليومية' : 'AI Daily Quota'}</div>
                <div className="font-bold mt-0.5 text-[#18c8ff]">
                  {entitlements.aiDailyLimit} {isAr ? '/ يوم' : '/ day'}
                </div>
              </div>
            </div>

            {activePlanConfig && (
              <ul className="space-y-2 text-[#cfd3ff] pt-1">
                {getLocalizedPlanFeatures(activePlanConfig, language).map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#22e06b] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={onGoToPricing}
              className="rounded-xl nv-btn-primary px-4 py-2 font-bold"
            >
              {isAr ? 'عرض الباقات والترقية' : 'View Plans & Upgrade'}
            </button>
          </div>

          <div className="nv-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#22e06b]" />
              <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                {isAr ? 'المزايا المفعّلة لحسابك' : 'Unlocked Feature Permissions'}
              </h3>
            </div>

            <div className="space-y-2">
              {[
                { label: isAr ? 'المزامنة السحابية ولقطات التشغيل' : 'Cloud Sync & Monitoring Snapshots', on: entitlements.cloudSyncEnabled },
                { label: isAr ? 'التحليلات المتقدمة والتشخيص الذكي' : 'Advanced Analytics & Smart Troubleshooting', on: entitlements.analyticsEnabled },
                { label: isAr ? 'وضع الألعاب وتتبع أوقات اليوم و ISP' : 'Gaming Mode, Time-of-Day & ISP Tracker', on: entitlements.gamingModeEnabled },
                { label: isAr ? 'قواعد التنبيه المخصصة السحابية' : 'Custom Cloud Alert Rules', on: entitlements.alertsEnabled },
                { label: isAr ? 'مساحات عمل المؤسسات وسجل التدقيق' : 'Business Organizations & Audit Logs', on: entitlements.teamManagementEnabled },
              ].map((perm) => (
                <div key={perm.label} className="nv-inner px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#cfd3ff]">{perm.label}</span>
                  {perm.on ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#22e06b]">
                      <Check className="h-3.5 w-3.5" />
                      {isAr ? 'مفعّل' : 'Active'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#9aa0d6]">
                      <X className="h-3.5 w-3.5 text-[#f06478]" />
                      {isAr ? 'مقيد' : 'Locked'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Billing History */}
      {activeTab === 'billing' && (
        <div className="nv-card p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#18c8ff]" />
              <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                {isAr ? 'سجل المدفوعات والفواتير' : 'Billing Receipts & Payments'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onGoToPricing}
              className="rounded-lg border border-[#262a6b] px-3 py-1.5 font-bold text-[#18c8ff] hover:border-[#18c8ff]"
            >
              {isAr ? 'صفحة الباقات' : 'Plans Page'}
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="nv-inner p-6 text-center space-y-2 text-[#9aa0d6]">
              <div>
                {isAr
                  ? 'لا توجد فواتير مدفوعة مسجلة لهذا الحساب حتى الآن.'
                  : 'No paid billing receipts recorded for this account yet.'}
              </div>
              <div className="text-[11px]">
                {isAr
                  ? 'سيتم إدراج فواتير الدفع الموثقة تلقائياً فور ربط بوابة الدفع في المرحلة القادمة.'
                  : 'Verified receipts will appear here automatically once live payment processing is enabled.'}
              </div>
            </div>
          ) : (
            <div className="space-y-2 font-mono-tabular">
              {payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 nv-inner px-3.5 py-2.5 text-[#eef0ff]">
                  <span className="font-sans font-bold">{formatPlanLabel(p.planId, language)}</span>
                  <span>
                    {(p.amountCents / 100).toFixed(2)} {p.currency}
                  </span>
                  <span className="uppercase text-[#22e06b]">
                    {isAr
                      ? p.status === 'paid'
                        ? 'مدفوع'
                        : p.status === 'pending'
                          ? 'قيد الانتظار'
                          : p.status === 'refunded'
                            ? 'مسترد'
                            : 'فشل'
                      : p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: My Devices */}
      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="nv-card p-5 lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-[#18c8ff]" />
                <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                  {isAr ? 'أجهزتي المسجلة' : 'My Registered Devices'}
                </h3>
              </div>
              <span className="font-mono-tabular text-[#9aa0d6]">
                {devices.length} / {entitlements.maxSavedDevices}
              </span>
            </div>

            <form onSubmit={handleAddDevice} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder={isAr ? 'اسم الجهاز (مثال: مكتبي الرئيسي)' : 'Device label (e.g. Home Workstation)'}
                className="flex-1 min-w-[160px] rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
              />
              <select
                value={newDeviceType}
                onChange={(e) => setNewDeviceType(e.target.value as UserDeviceDoc['deviceType'])}
                className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
              >
                <option value="desktop">{isAr ? 'كمبيوتر مكتبي' : 'Desktop'}</option>
                <option value="laptop">{isAr ? 'لابتوب' : 'Laptop'}</option>
                <option value="mobile">{isAr ? 'هاتف محمول' : 'Mobile'}</option>
                <option value="router">{isAr ? 'راوتر' : 'Router'}</option>
                <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl nv-btn-primary px-3.5 py-2 font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isAr ? 'إضافة' : 'Register'}</span>
              </button>
            </form>

            {devices.length === 0 ? (
              <div className="py-6 text-center text-[#9aa0d6]">
                {isAr ? 'لا توجد أجهزة مسجلة بعد.' : 'No devices registered yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((dev) => (
                  <div key={dev.id} className="nv-inner px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {dev.deviceType === 'mobile' ? (
                        <Smartphone className="h-4 w-4 text-[#a855f7] shrink-0" />
                      ) : (
                        <Laptop className="h-4 w-4 text-[#18c8ff] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold truncate text-[#eef0ff]">{dev.name}</div>
                        <div className="text-[11px] text-[#9aa0d6] truncate">
                          {isAr
                            ? dev.deviceType === 'desktop'
                              ? 'كمبيوتر مكتبي'
                              : dev.deviceType === 'laptop'
                                ? 'لابتوب'
                                : dev.deviceType === 'mobile'
                                  ? 'هاتف محمول'
                                  : dev.deviceType === 'router'
                                    ? 'راوتر'
                                    : 'أخرى'
                            : dev.deviceType}{' '}
                          {dev.isp ? `· ${dev.isp}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteUserDevice(user.uid, dev.id);
                        await loadAccountCollections();
                      }}
                      className="p-1.5 text-[#9aa0d6] hover:text-[#f06478]"
                      aria-label="Remove device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="nv-card p-5 lg:col-span-5 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#f5b942]" />
              <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                {isAr ? 'حدود المتصفح ووكيل سطح المكتب' : 'Browser Boundary & Desktop Agent'}
              </h3>
            </div>
            <p className="text-[#cfd3ff] leading-relaxed">
              {isAr
                ? 'يعرض NOVYRA Net حالياً بيانات Web Connection API وحركة HTTP/TCP الحقيقية فقط. قراءة قوة إشارة Wi-Fi بالـ dBm، نوع التردد 2.4/5GHz، ومراقبة استهلاك كل برنامج على حدة تتطلب تثبيت وكيل سطح المكتب المستقبلي.'
                : 'Web browsers restrict direct access to Wi-Fi dBm RSSI, 2.4/5 GHz band radio details, and per-process OS socket bandwidth counters. NOVYRA Net never fabricates these values — future companion desktop agents will stream them cleanly into your account.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: Cloud Data & Snapshots */}
      {activeTab === 'cloud' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <div className="nv-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-[#a855f7]" />
                <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                  {isAr ? 'المزامنة السحابية والنسخ الاحتياطي' : 'Cloud Backup & Data Sync'}
                </h3>
              </div>
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                  cloudEnabled ? 'bg-[#22e06b]/15 text-[#22e06b]' : 'bg-[#f5b942]/15 text-[#f5b942]'
                }`}
              >
                {cloudEnabled ? (isAr ? 'مفعّلة' : 'SYNC READY') : isAr ? 'ميزة PRO' : 'PRO FEATURE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono-tabular">
              <div className="nv-inner p-3">
                <div className="text-[#9aa0d6] font-sans">
                  {isAr ? 'السجلات المحلية المحفوظة' : 'Local Records'}
                </div>
                <div className="text-lg font-bold mt-0.5 text-[#eef0ff]">{localHistory.length}</div>
              </div>
              <div className="nv-inner p-3">
                <div className="text-[#9aa0d6] font-sans">
                  {isAr ? 'السجلات السحابية' : 'Cloud Records'}
                </div>
                <div className="text-lg font-bold mt-0.5 text-[#eef0ff]">{cloudCount ?? '—'}</div>
              </div>
            </div>

            <p className="text-[11px] text-[#9aa0d6] leading-relaxed">
              {isAr
                ? 'يتم دمج اختباراتك المحلية بأمان إلى السحابة دون حذف بيانات المتصفح الحالية.'
                : 'Safely migrates local speed tests to encrypted user-owned cloud storage without deleting existing local records.'}
            </p>

            <button
              type="button"
              disabled={syncing}
              onClick={handleMigrateToCloud}
              className="inline-flex items-center gap-1.5 rounded-xl nv-btn-primary px-4 py-2 font-bold disabled:opacity-50"
            >
              {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
              <span>
                {cloudEnabled
                  ? isAr
                    ? 'مزامنة ودمج الآن'
                    : 'Sync & Merge Now'
                  : isAr
                    ? 'ترقية لتفعيل السحابة'
                    : 'Upgrade to Enable Cloud Sync'}
              </span>
            </button>
          </div>

          <div className="nv-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#18c8ff]" />
                <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                  {isAr ? 'أحدث لقطات المراقبة السحابية' : 'Recent Monitoring Snapshots'}
                </h3>
              </div>
              <span className="font-mono-tabular text-[#9aa0d6]">{snapshots.length}</span>
            </div>

            {snapshots.length === 0 ? (
              <div className="nv-inner p-6 text-center text-[#9aa0d6]">
                {isAr
                  ? 'لا توجد لقطات مراقبة محفوظة بعد. يمكنك حفظ لقطة من شاشة مراقبة الشبكة.'
                  : 'No monitoring snapshots saved yet. Save snapshots directly from Network Monitor.'}
              </div>
            ) : (
              <div className="space-y-2 font-mono-tabular">
                {snapshots.slice(0, 6).map((snap) => (
                  <div key={snap.id} className="nv-inner px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#22e06b] font-bold">{snap.onlinePercent.toFixed(1)}% UP</span>
                    <span className="text-[#18c8ff]">{snap.avgLatencyMs.toFixed(1)} ms avg</span>
                    <span className="text-[#9aa0d6]">{snap.sampleCount} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Profile & Security */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <form onSubmit={handleSaveProfile} className="nv-card p-5 space-y-3">
            <h3 className="font-display text-sm font-bold text-[#eef0ff]">
              {isAr ? 'بيانات الملف الشخصي' : 'Profile Settings'}
            </h3>
            <div>
              <label className="block mb-1 text-[#9aa0d6]">{isAr ? 'الاسم المعروض' : 'Display Name'}</label>
              <input
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
              />
            </div>
            <div>
              <label className="block mb-1 text-[#9aa0d6]">{isAr ? 'الدولة' : 'Country'}</label>
              <input
                type="text"
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl nv-btn-primary px-4 py-2 font-bold disabled:opacity-50"
            >
              {savingProfile ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ التغييرات' : 'Save Profile'}
            </button>
          </form>

          <div className="nv-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#18c8ff]" />
              <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                {isAr ? 'أمان الحساب' : 'Account Security'}
              </h3>
            </div>

            {hasPasswordProvider ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newPwd.length < 8) {
                    onNotify('error', isAr ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' : 'Minimum 8 characters');
                    return;
                  }
                  try {
                    await changePassword(curPwd, newPwd);
                    setCurPwd('');
                    setNewPwd('');
                    onNotify('success', isAr ? 'تم تغيير كلمة المرور بنجاح' : 'Password updated');
                  } catch (err) {
                    onNotify('error', isAr ? 'فشل تحديث كلمة المرور' : 'Password update failed', err instanceof Error ? err.message : undefined);
                  }
                }}
                className="space-y-2.5"
              >
                <input
                  type="password"
                  value={curPwd}
                  onChange={(e) => setCurPwd(e.target.value)}
                  placeholder={isAr ? 'كلمة المرور الحالية' : 'Current password'}
                  className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder={isAr ? 'كلمة المرور الجديدة (8+ أحرف)' : 'New password (8+ chars)'}
                  className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-[#262a6b] bg-[#0d1033] px-4 py-2 font-bold text-[#eef0ff] hover:border-[#18c8ff]"
                >
                  {isAr ? 'تحديث كلمة المرور' : 'Change Password'}
                </button>
              </form>
            ) : (
              <p className="text-[#9aa0d6]">
                {isAr
                  ? 'حسابك محمي وموثق عبر تسجيل الدخول بحساب Google.'
                  : 'Your account authentication is managed through verified Google OAuth.'}
              </p>
            )}

            <div className="pt-3 border-t border-[#262a6b]/60">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#f06478]/40 bg-[#f06478]/10 px-3.5 py-2 font-bold text-[#f06478]"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{isAr ? 'حذف الحساب نهائياً' : 'Delete Account Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="nv-card max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="font-display text-base font-bold text-[#f06478]">
              {isAr ? 'تأكيد حذف الحساب نهائياً' : 'Confirm Account Deletion'}
            </h3>
            <p className="text-[#cfd3ff]">
              {isAr
                ? 'سيؤدي هذا إلى حذف حسابك وملفك السحابي. نتائجك المحلية في المتصفح تبقى محفوظة إلا إذا حذفتها.'
                : 'This permanently deletes your cloud account. Re-authentication is required for security.'}
            </p>
            {hasPasswordProvider && (
              <input
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                placeholder={isAr ? 'أدخل كلمة المرور الحالية للتأكيد' : 'Enter current password to confirm'}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="rounded-xl border border-[#262a6b] px-4 py-2 font-semibold text-[#cfd3ff]"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteAccountSafely(hasPasswordProvider ? deletePwd : undefined);
                    setDeleteDialogOpen(false);
                    onNotify('info', isAr ? 'تم حذف الحساب.' : 'Account deleted.');
                  } catch (err) {
                    onNotify(
                      'error',
                      isAr ? 'فشل الحذف — أعد تسجيل الدخول أولاً' : 'Deletion requires recent login',
                      err instanceof Error ? err.message : undefined,
                    );
                  }
                }}
                className="rounded-xl bg-[#dc2626] px-4 py-2 font-bold text-white"
              >
                {isAr ? 'تأكيد الحذف' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
