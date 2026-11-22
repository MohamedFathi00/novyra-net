import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Crown,
  HelpCircle,
  Loader2,
  Minus,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import type { CouponDoc, Language, PlanId } from '../types/network';
import { useAuth } from '../context/AuthContext';
import {
  formatPlanLabel,
  formatPlanPriceLabel,
  formatSubscriptionStatusLabel,
  getLocalizedPlanFeatures,
} from '../services/entitlementService';
import { validateCouponCode } from '../services/cloudSyncService';
import {
  createCheckoutSession,
  fetchBillingStatus,
  verifyCheckoutSession,
  type BillingStatusResponse,
} from '../services/billingClientService';

interface PricingViewProps {
  language: Language;
  onRequireAuth: () => void;
  onNotify: (type: 'success' | 'info' | 'warning' | 'error', title: string, desc?: string) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  language,
  onRequireAuth,
  onNotify,
}) => {
  const isAr = language === 'ar';
  const { user, emailVerified, plansCatalog, entitlements, getIdToken, refreshBillingAndProfile } = useAuth();
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponDoc | null>(null);
  const [couponStatus, setCouponStatus] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState<PlanId | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetchBillingStatus().then(setBillingStatus).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const checkoutParam = params.get('checkout');
    const sessionId = params.get('session_id');
    if (checkoutParam === 'cancelled') {
      setCheckoutNotice({
        type: 'warning',
        text: isAr ? 'تم إلغاء عملية الدفع قبل إتمامها.' : 'Checkout was cancelled before completion.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (checkoutParam === 'success' && sessionId && user && emailVerified) {
      (async () => {
        try {
          const token = await getIdToken();
          if (!token) return;
          const result = await verifyCheckoutSession(sessionId, token);
          if (result.verified) {
            setCheckoutNotice({
              type: 'success',
              text: isAr
                ? `تم التحقق من الدفع لباقة ${formatPlanLabel(result.planId, 'ar')} عبر مزود الدفع.`
                : `Payment verified for ${result.planId.toUpperCase()} (${result.paymentStatus}).`,
            });
            await refreshBillingAndProfile();
          } else {
            setCheckoutNotice({
              type: 'warning',
              text: isAr
                ? `حالة الجلسة الحالية: ${result.paymentStatus}`
                : `Session status: ${result.paymentStatus}`,
            });
          }
          window.history.replaceState({}, '', window.location.pathname);
        } catch (err) {
          setCheckoutNotice({
            type: 'error',
            text:
              err instanceof Error
                ? err.message
                : isAr
                  ? 'تعذر التحقق من جلسة الدفع.'
                  : 'Unable to verify checkout session.',
          });
        }
      })();
    }
  }, [emailVerified, getIdToken, isAr, refreshBillingAndProfile, user]);

  const handleApplyCoupon = async () => {
    const clean = couponInput.trim().toUpperCase();
    if (!clean) return;
    if (!user || !emailVerified) {
      setCouponStatus(isAr ? 'سجّل الدخول بحساب مؤكد لتفعيل الكوبون.' : 'Sign in with verified email to validate coupons.');
      return;
    }
    const found = await validateCouponCode(clean, 'any');
    if (found) {
      setAppliedCoupon(found);
      const planScopeLabel =
        found.applicablePlan === 'all'
          ? isAr
            ? 'جميع الباقات'
            : 'all plans'
          : isAr
            ? formatPlanLabel(found.applicablePlan, 'ar')
            : found.applicablePlan;
      setCouponStatus(
        isAr
          ? `تم تفعيل خصم ${found.discountPercent}% (${found.code}) على باقة: ${planScopeLabel}`
          : `Coupon ${found.code} applied (${found.discountPercent}% off · ${planScopeLabel})`,
      );
    } else {
      setAppliedCoupon(null);
      setCouponStatus(isAr ? 'الكوبون غير صالح أو منتهي الصلاحية.' : 'Coupon code is invalid or expired.');
    }
  };

  const handleSubscribe = async (planId: 'pro' | 'business') => {
    if (!user || !emailVerified) {
      onRequireAuth();
      return;
    }
    const plan = plansCatalog[planId];
    const baseCents = cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
    if (!plan.pricingConfigured || baseCents <= 0 || !billingStatus?.configured) {
      onNotify(
        'info',
        isAr ? 'الدفع الإلكتروني مؤجل حالياً' : 'Online Payment Setup Deferred',
        isAr
          ? 'جميع مزايا الباقة جاهزة، وسيتم تفعيل بوابة الدفع والأسعار في المرحلة القادمة.'
          : 'Plan features are ready; Stripe checkout credentials and pricing will be enabled in the next billing step.',
      );
      return;
    }

    const discountedCents =
      appliedCoupon && (appliedCoupon.applicablePlan === 'all' || appliedCoupon.applicablePlan === planId)
        ? Math.max(50, Math.round(baseCents * (1 - appliedCoupon.discountPercent / 100)))
        : baseCents;

    setCheckoutBusy(planId);
    setCheckoutNotice(null);
    try {
      const token = await getIdToken();
      if (!token) {
        onRequireAuth();
        return;
      }
      const session = await createCheckoutSession({
        idToken: token,
        planId,
        billingCycle: cycle,
        unitAmountCents: discountedCents,
        currency: plan.currency,
        planName: plan.name,
        couponCode: appliedCoupon?.code,
      });
      window.location.assign(session.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : isAr ? 'تعذر بدء عملية الدفع.' : 'Checkout failed.';
      setCheckoutNotice({ type: 'error', text: msg });
      onNotify('error', isAr ? 'تعذر بدء الدفع' : 'Checkout Unavailable', msg);
    } finally {
      setCheckoutBusy(null);
    }
  };

  const plans: PlanId[] = ['free', 'pro', 'business'];

  const comparisonRows: Array<{
    feature: string;
    free: string | boolean;
    pro: string | boolean;
    business: string | boolean;
  }> = [
    {
      feature: isAr ? 'اختبار السرعة الحقيقي (تحميل/رفع/Ping/Jitter)' : 'Real Speed Benchmark (DL / UL / Ping / Jitter)',
      free: true,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'تشخيص DNS و Ping والمنافذ و Traceroute والراوتر' : 'DNS, TCP Ping, Port Check, Traceroute & Router Info',
      free: true,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'حفظ سجل الاختبارات' : 'Test History Storage',
      free: isAr ? '20 سجل محلي' : '20 Local',
      pro: isAr ? 'سحابي غير محدود' : 'Unlimited Cloud',
      business: isAr ? 'سحابي غير محدود' : 'Unlimited Cloud',
    },
    {
      feature: isAr ? 'الأجهزة المسجلة' : 'Registered Devices',
      free: isAr ? 'جهاز واحد' : '1 Device',
      pro: isAr ? 'حتى 10 أجهزة' : 'Up to 10 Devices',
      business: isAr ? 'حتى 100 جهاز للمؤسسة' : 'Up to 100 Org Devices',
    },
    {
      feature: isAr ? 'الحصة اليومية لمستشار NOVYRA الذكي' : 'NOVYRA AI Advisor Daily Quota',
      free: isAr ? '3 تحليلات / يوم' : '3 / day',
      pro: isAr ? '50 تحليلاً / يوم' : '50 / day',
      business: isAr ? '250 تحليلاً / يوم' : '250 / day',
    },
    {
      feature: isAr ? 'وضع الألعاب وتقييم Bufferbloat' : 'Gaming Mode & Bufferbloat Grading',
      free: false,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'رسوم استقرار الاتصال حسب أوقات اليوم وتتبع ISP' : 'Time-of-Day Stability Charts & ISP Tracker',
      free: false,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'سير عمل التشخيص التلقائي الذكي' : 'Automated Smart Troubleshooting Diagnostics',
      free: false,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'لقطات سحابية لنسبة التشغيل والاستقرار (Uptime %)' : 'Cloud Monitoring Uptime Snapshots',
      free: false,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'قواعد التنبيه المخصصة المحفوظة سحابياً' : 'Custom Cloud Alert Rules',
      free: false,
      pro: true,
      business: true,
    },
    {
      feature: isAr ? 'مساحات عمل المؤسسات وصلاحيات الفريق (4 أدوار)' : 'Organizations & 4-Role Access Control',
      free: false,
      pro: false,
      business: true,
    },
    {
      feature: isAr ? 'القياس المركزي لأسطول الأجهزة وسجلات نشاط المؤسسة' : 'Centralized Fleet Telemetry & Activity Audit Logs',
      free: false,
      pro: false,
      business: true,
    },
  ];

  const faqItems = isAr
    ? [
        {
          q: 'هل تبقى الباقة المجانية متاحة بدون بطاقة بنكية؟',
          a: 'نعم، الباقة المجانية متاحة للأبد بدون بطاقة دفع وتشمل قياس السرعة الحقيقي وأدوات التشخيص الأساسية وحفظ حتى 20 اختباراً محلياً.',
        },
        {
          q: 'متى سيتم تفعيل بوابة الدفع الإلكتروني؟',
          a: 'جميع مزايا وبنية باقتي Pro و Business مفعّلة ومكتملة الآن داخل التطبيق، وسيتم ربط بوابة الدفع Stripe وتحديد الأسعار النهائية في مرحلة التفعيل المالي التالية.',
        },
        {
          q: 'ما الذي تضيفه باقة Business فوق باقة Pro؟',
          a: 'تضيف مساحات عمل للمؤسسات (حتى 25 عضواً بأدوار مالك/مسؤول/مدير/مشاهد)، وإدارة حتى 100 جهاز فرع، ولوحة قياس مركزي للأسطول وسجلات تدقيق نشاط المؤسسة وتصدير CSV، مع 250 استشارة AI يومياً.',
        },
        {
          q: 'كيف تُحمى بيانات الحساب والمؤسسات؟',
          a: 'كل البيانات الحساسة والاختبارات السحابية وبيانات المؤسسات معزولة بصلاحيات تحقق صارمة في Firestore ولا يمكن لأي مستخدم غير مصرح الوصول إليها.',
        },
      ]
    : [
        {
          q: 'Does Free Explorer stay free forever without a card?',
          a: 'Yes. Free Explorer includes real speed benchmarks, core DNS/TCP/Port/Router diagnostics, and up to 20 local test records with no credit card required.',
        },
        {
          q: 'When will live card checkout be enabled?',
          a: 'All Pro and Business platform modules are already live in NOVYRA Net. Online Stripe checkout and final pricing configuration are scheduled cleanly for the upcoming payment phase.',
        },
        {
          q: 'What does NOVYRA Business add beyond NOVYRA Pro?',
          a: 'Business adds multi-user organizations (up to 25 members with Owner/Admin/Manager/Viewer roles), up to 100 branch devices, centralized fleet telemetry tracking, activity audit logs, and 250 AI Advisor requests/day.',
        },
        {
          q: 'How are cloud backups and team records protected?',
          a: 'All cloud-synced records, device telemetry, and organization data are guarded by verified authentication and zero-trust Firestore rules.',
        },
      ];

  const renderCell = (val: string | boolean) => {
    if (val === true) {
      return <Check className="h-4 w-4 text-[#22e06b] mx-auto" />;
    }
    if (val === false) {
      return <Minus className="h-4 w-4 text-[#5a6099] mx-auto" />;
    }
    return <span className="font-mono-tabular font-semibold text-[#eef0ff]">{val}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#eef0ff]">
            {isAr ? 'الباقات والاشتراكات' : 'Plans & Commercial Tiers'}
          </h2>
          <p className="text-sm text-[#cfd3ff] mt-0.5">
            {isAr
              ? `خطتك الحالية: ${plansCatalog[entitlements.planId]?.nameAr || formatPlanLabel(entitlements.planId, 'ar')} (${formatSubscriptionStatusLabel(entitlements.subscriptionStatus, 'ar')})`
              : `Current active plan: ${entitlements.planId.toUpperCase()} (${entitlements.subscriptionStatus})`}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#262a6b] p-1 bg-[#0d1033]">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
              cycle === 'monthly' ? 'nv-btn-primary' : 'text-[#9aa0d6] hover:text-white'
            }`}
          >
            {isAr ? 'فوترة شهرية' : 'Monthly'}
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
              cycle === 'annual' ? 'nv-btn-primary' : 'text-[#9aa0d6] hover:text-white'
            }`}
          >
            {isAr ? 'فوترة سنوية' : 'Annual'}
          </button>
        </div>
      </div>

      {/* Honest Deferred Billing Notice */}
      {billingStatus && !billingStatus.configured && (
        <div className="rounded-2xl border border-[#18c8ff]/35 bg-[#18c8ff]/10 p-4 flex items-start gap-3 text-xs">
          <Clock className="h-5 w-5 text-[#18c8ff] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-[#eef0ff]">
              {isAr
                ? 'جميع مزايا الباقات جاهزة — سيتم ربط الدفع الإلكتروني لاحقاً'
                : 'Plan Capabilities Ready — Online Payment Integration Deferred'}
            </div>
            <p className="text-[#cfd3ff] leading-relaxed">
              {isAr
                ? 'تم بناء كامل مزايا باقات المجاني وبرو والأعمال أولاً. بوابة الدفع الإلكتروني (Stripe) والتسعير النهائي سيتم تفعيلهما في المرحلة القادمة دون أي عمليات دفع وهمية.'
                : 'All Free, Pro, and Business capabilities are fully built. Stripe live checkout and commercial pricing credentials will be wired in the upcoming billing phase with zero simulated payments.'}
            </p>
          </div>
        </div>
      )}

      {checkoutNotice && (
        <div
          className={`rounded-2xl border p-4 text-xs flex items-center gap-2.5 ${
            checkoutNotice.type === 'success'
              ? 'border-[#22e06b]/40 bg-[#22e06b]/10 text-[#22e06b]'
              : checkoutNotice.type === 'warning'
                ? 'border-[#f5b942]/40 bg-[#f5b942]/10 text-[#f5b942]'
                : 'border-[#f06478]/40 bg-[#f06478]/10 text-[#f06478]'
          }`}
        >
          {checkoutNotice.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{checkoutNotice.text}</span>
        </div>
      )}

      {/* Coupon Bar */}
      <div className="nv-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[#18c8ff]" />
          <span className="font-semibold text-[#eef0ff]">
            {isAr ? 'هل لديك كود خصم؟' : 'Have a Promo Coupon?'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder={isAr ? 'أدخل الكود' : 'COUPON CODE'}
            className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-1.5 font-mono-tabular uppercase text-[#eef0ff]"
          />
          <button
            type="button"
            onClick={handleApplyCoupon}
            className="rounded-xl border border-[#262a6b] bg-[#10134a] px-3.5 py-1.5 font-bold text-[#eef0ff] hover:border-[#18c8ff]"
          >
            {isAr ? 'تحقق' : 'Apply'}
          </button>
        </div>
        {couponStatus && <div className="w-full text-[11px] text-[#18c8ff]">{couponStatus}</div>}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((planId) => {
          const plan = plansCatalog[planId];
          const isCurrent = entitlements.planId === planId;
          const isPro = planId === 'pro';
          const isBusiness = planId === 'business';
          const annualSavingsPct =
            plan.monthlyPriceCents > 0 &&
            plan.annualPriceCents > 0 &&
            plan.annualPriceCents < plan.monthlyPriceCents * 12
              ? Math.round((1 - plan.annualPriceCents / (plan.monthlyPriceCents * 12)) * 100)
              : 0;
          const paymentReady = Boolean(
            billingStatus?.configured &&
              plan.pricingConfigured &&
              (cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents) > 0,
          );

          return (
            <div
              key={plan.id}
              className={`nv-card p-6 flex flex-col justify-between space-y-5 ${
                isPro ? 'border-[#7a6bff]' : isBusiness ? 'border-[#f5b942]/45' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown
                      className={`h-4 w-4 ${
                        isBusiness
                          ? 'text-[#f5b942]'
                          : isPro
                            ? 'text-[#18c8ff]'
                            : 'text-[#9aa0d6]'
                      }`}
                    />
                    <h3 className="font-display text-lg font-bold text-[#eef0ff]">
                      {isAr ? plan.nameAr : plan.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isPro && !isCurrent && (
                      <span className="rounded-lg bg-[#6555FF]/20 border border-[#7a6bff]/50 px-2 py-0.5 text-[10px] font-bold text-[#18c8ff]">
                        {isAr ? 'الأكثر طلباً' : 'POPULAR'}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-lg bg-[#22e06b]/15 border border-[#22e06b]/40 px-2 py-0.5 text-[10px] font-bold text-[#22e06b]">
                        {isAr ? 'الباقة الحالية' : 'ACTIVE'}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#9aa0d6]">
                  {isAr ? plan.taglineAr : plan.tagline}
                </p>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-xl font-bold text-[#18c8ff] font-mono-tabular">
                      {formatPlanPriceLabel(plan, cycle, language)}
                    </div>
                    {cycle === 'annual' && annualSavingsPct > 0 && (
                      <span className="rounded-lg bg-[#22e06b]/15 border border-[#22e06b]/40 px-2 py-0.5 text-[10px] font-bold text-[#22e06b] font-mono-tabular">
                        {isAr ? `وفر ${annualSavingsPct}%` : `SAVE ${annualSavingsPct}%`}
                      </span>
                    )}
                  </div>
                  {plan.id !== 'free' &&
                    plan.pricingConfigured &&
                    appliedCoupon &&
                    (appliedCoupon.applicablePlan === 'all' || appliedCoupon.applicablePlan === plan.id) &&
                    ((cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents) > 0) && (
                      <div className="text-[11px] font-bold text-[#22e06b] font-mono-tabular mt-0.5">
                        {isAr ? 'بعد الخصم:' : 'With coupon:'}{' '}
                        {plan.currency}{' '}
                        {(
                          Math.max(
                            50,
                            Math.round(
                              (cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents) *
                                (1 - appliedCoupon.discountPercent / 100),
                            ),
                          ) / 100
                        ).toFixed(2)}
                      </div>
                    )}
                </div>

                <div className="nv-inner p-3 space-y-1.5 text-[11px] font-mono-tabular">
                  <div className="flex justify-between">
                    <span className="text-[#9aa0d6]">
                      {isAr ? 'حصة AI اليومية:' : 'AI Advisor / day:'}
                    </span>
                    <span className="font-bold text-[#eef0ff]">{plan.maxAiRequestsPerDay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9aa0d6]">
                      {isAr ? 'سجل الاختبارات:' : 'Saved History:'}
                    </span>
                    <span className="font-bold text-[#eef0ff]">
                      {plan.maxHistoryRecords === -1 ? (isAr ? 'غير محدود' : 'Unlimited') : plan.maxHistoryRecords}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9aa0d6]">
                      {isAr ? 'الأجهزة المسجلة:' : 'Devices:'}
                    </span>
                    <span className="font-bold text-[#eef0ff]">{plan.maxSavedDevices}</span>
                  </div>
                  {isBusiness && (
                    <div className="flex justify-between">
                      <span className="text-[#9aa0d6]">
                        {isAr ? 'أعضاء المؤسسة:' : 'Team Seats:'}
                      </span>
                      <span className="font-bold text-[#f5b942]">{plan.maxOrgMembers}</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-2 text-xs text-[#cfd3ff]">
                  {getLocalizedPlanFeatures(plan, language).map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-[#22e06b] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {plan.id === 'free' ? (
                <div className="rounded-xl border border-[#262a6b] bg-[#0d1033] py-2.5 text-center text-xs font-semibold text-[#9aa0d6]">
                  {isCurrent ? (isAr ? 'مفعّلة افتراضياً' : 'Active Base Plan') : isAr ? 'الباقة الأساسية' : 'Base Free Tier'}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={checkoutBusy !== null || isCurrent}
                  onClick={() => handleSubscribe(plan.id as 'pro' | 'business')}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-45 ${
                    paymentReady
                      ? 'nv-btn-primary'
                      : 'border border-[#7a6bff]/50 bg-[#10134a] text-[#eef0ff] hover:border-[#18c8ff]'
                  }`}
                >
                  {checkoutBusy === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : paymentReady ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4 text-[#18c8ff]" />
                  )}
                  <span>
                    {isCurrent
                      ? isAr
                        ? 'مفعّلة لحسابك'
                        : 'Current Plan'
                      : !paymentReady
                        ? isAr
                          ? 'سيتم تفعيل الدفع لاحقاً'
                          : 'Payment Setup Deferred'
                        : isAr
                          ? 'الاشتراك عبر الدفع الآمن'
                          : 'Subscribe via Secure Checkout'}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Matrix */}
      <section className="nv-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#18c8ff]" />
          <h3 className="font-display text-sm font-bold text-[#eef0ff]">
            {isAr ? 'مقارنة شاملة بين الباقات' : 'Full Feature Comparison Matrix'}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#262a6b] text-[#9aa0d6]">
                <th className="py-2.5 text-start font-semibold">{isAr ? 'الميزة' : 'Capability'}</th>
                <th className="py-2.5 text-center font-semibold">{formatPlanLabel('free', language)}</th>
                <th className="py-2.5 text-center font-semibold text-[#18c8ff]">
                  {formatPlanLabel('pro', language)}
                </th>
                <th className="py-2.5 text-center font-semibold text-[#f5b942]">
                  {formatPlanLabel('business', language)}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262a6b]/50">
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="hover:bg-[#10134a]/40 transition-colors">
                  <td className="py-2.5 pe-4 text-[#cfd3ff]">{row.feature}</td>
                  <td className="py-2.5 text-center">{renderCell(row.free)}</td>
                  <td className="py-2.5 text-center">{renderCell(row.pro)}</td>
                  <td className="py-2.5 text-center">{renderCell(row.business)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Billing & Plans FAQ Accordion */}
      <section className="nv-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[#a855f7]" />
          <h3 className="font-display text-sm font-bold text-[#eef0ff]">
            {isAr ? 'الأسئلة الشائعة حول الباقات' : 'Plans & Billing FAQ'}
          </h3>
        </div>

        <div className="space-y-2">
          {faqItems.map((item, idx) => {
            const expanded = openFaq === idx;
            return (
              <div key={item.q} className="nv-inner overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(expanded ? null : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-start text-xs font-bold text-[#eef0ff]"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#18c8ff] shrink-0 transition-transform ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expanded && (
                  <div className="px-4 pb-3 text-xs text-[#9aa0d6] leading-relaxed border-t border-[#262a6b]/50 pt-2.5">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
