import React from 'react';
import { Crown, Lock, Sparkles, X } from 'lucide-react';
import type { Language, PlanId } from '../types/network';

interface PremiumFeatureLockProps {
  language: Language;
  featureTitle: string;
  featureTitleAr: string;
  description: string;
  descriptionAr: string;
  requiredPlan?: 'pro' | 'business';
  currentPlan: PlanId;
  isSignedIn: boolean;
  onUpgrade: () => void;
  onSignIn: () => void;
}

export const PremiumFeatureLock: React.FC<PremiumFeatureLockProps> = ({
  language,
  featureTitle,
  featureTitleAr,
  description,
  descriptionAr,
  requiredPlan = 'pro',
  currentPlan,
  isSignedIn,
  onUpgrade,
  onSignIn,
}) => {
  const isAr = language === 'ar';
  const badgeLabel = requiredPlan === 'business' ? 'BUSINESS' : 'PRO';

  return (
    <div className="nv-card p-6 sm:p-8 border-[#6555FF]/40 relative overflow-hidden">
      <div className="absolute -top-24 -end-24 h-56 w-56 rounded-full bg-[#6555FF]/15 blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-xl mx-auto text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22c1ff]/20 to-[#6a5cff]/25 border border-[#7a6bff]/40 text-[#18c8ff]">
          <Lock className="h-6 w-6" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#6555FF]/20 border border-[#7a6bff]/40 px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#cfd3ff]">
          <Crown className="h-3.5 w-3.5 text-[#f5b942]" />
          <span>{badgeLabel}</span>
          <span>·</span>
          <span>
            {isAr ? `خطتك الحالية: ${currentPlan.toUpperCase()}` : `Current: ${currentPlan.toUpperCase()}`}
          </span>
        </div>
        <h3 className="font-display text-xl font-bold text-[#141847] dark:text-[#eef0ff]">
          {isAr ? featureTitleAr : featureTitle}
        </h3>
        <p className="text-sm text-[#4c538c] dark:text-[#cfd3ff] leading-relaxed">
          {isAr ? descriptionAr : description}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 rounded-xl nv-btn-primary px-5 py-2.5 text-xs font-bold"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isAr
                ? requiredPlan === 'business'
                  ? 'عرض باقة Business والترقية'
                  : 'الترقية إلى NOVYRA Pro'
                : requiredPlan === 'business'
                  ? 'Explore Business Plan'
                  : 'Upgrade to NOVYRA Pro'}
            </span>
          </button>

          {!isSignedIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-white/80 dark:bg-[#10134a]/70 px-4 py-2.5 text-xs font-semibold text-[#141847] dark:text-[#eef0ff] hover:border-[#18c8ff]"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface UpgradeModalProps {
  open: boolean;
  language: Language;
  requiredPlan?: 'pro' | 'business';
  reason?: string;
  onClose: () => void;
  onGoToPricing: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  language,
  requiredPlan = 'pro',
  reason,
  onClose,
  onGoToPricing,
}) => {
  if (!open) return null;
  const isAr = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="nv-card max-w-md w-full p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 end-4 rounded-lg p-1.5 text-[#9aa0d6] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#22c1ff]/20 to-[#6a5cff]/25 text-[#18c8ff]">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[#141847] dark:text-[#eef0ff]">
              {isAr
                ? requiredPlan === 'business'
                  ? 'مطلوب باقة NOVYRA Business'
                  : 'ترقية إلى NOVYRA Pro'
                : requiredPlan === 'business'
                  ? 'NOVYRA Business Required'
                  : 'Upgrade to NOVYRA Pro'}
            </h3>
            <p className="text-xs text-[#5a6099] dark:text-[#9aa0d6]">
              {isAr ? 'افتح الميزات السحابية والتقارير المتقدمة' : 'Unlock cloud intelligence, alerts & unlimited history'}
            </p>
          </div>
        </div>

        <p className="text-xs text-[#4c538c] dark:text-[#cfd3ff] leading-relaxed">
          {reason ||
            (isAr
              ? 'هذه الميزة مفعّلة للمشتركين في الباقات المدفوعة عبر نظام الصلاحيات المحمي.'
              : 'This capability is unlocked for verified subscribers through server-verified plan entitlements.')}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] px-4 py-2 text-xs font-semibold"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToPricing();
            }}
            className="rounded-xl nv-btn-primary px-4 py-2 text-xs font-bold"
          >
            {isAr ? 'عرض الباقات والأسعار' : 'View Plans & Pricing'}
          </button>
        </div>
      </div>
    </div>
  );
};
