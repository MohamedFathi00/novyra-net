import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  Crown,
  HelpCircle,
  Info,
  LogIn,
  Menu,
  Play,
  Settings,
  SlidersHorizontal,
  Square,
  Trash2,
  UserCircle2,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import type { AnimationStyle, Language, NavSection, NotificationItem, PlanId } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { formatPlanLabel } from '../services/entitlementService';
import { NovyraLogo } from './NovyraLogo';
import { HeaderAnimatedBackdrop } from './HeaderAnimatedBackdrop';

interface TopBarProps {
  activeSection: NavSection;
  online: boolean;
  isTesting: boolean;
  onQuickTest: () => void;
  onStopTest: () => void;
  language: Language;
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenMobileMenu: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClearNotifications: () => void;
  onOpenAlerts: () => void;
  onRequestBrowserNotifications: () => Promise<void> | void;
  isSignedIn: boolean;
  userDisplayName?: string | null;
  planId: PlanId;
  onOpenAccount: () => void;
  onOpenAuth: () => void;
  onOpenPricing: () => void;
  animationsEnabled?: boolean;
  animationStyle?: AnimationStyle;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  online,
  isTesting,
  onQuickTest,
  onStopTest,
  language,
  onToggleLanguage,
  onOpenSettings,
  onOpenHelp,
  onOpenMobileMenu,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onClearNotifications,
  onOpenAlerts,
  onRequestBrowserNotifications,
  isSignedIn,
  userDisplayName,
  planId,
  onOpenAccount,
  onOpenAuth,
  onOpenPricing,
  animationsEnabled = true,
  animationStyle = 'cyber',
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const browserNotifSupported = typeof window !== 'undefined' && 'Notification' in window;
  const browserNotifPerm = browserNotifSupported ? window.Notification.permission : 'denied';

  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notifOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const pageTitleMap: Record<NavSection, string> = {
    overview: t.nav.overview,
    speedtest: t.nav.speedtest,
    monitoring: t.nav.monitoring,
    diagnostics: t.nav.diagnostics,
    info: t.nav.info,
    dns: t.nav.dns,
    history: t.nav.history,
    analytics: t.nav.analytics,
    gaming: isAr ? 'وضع الألعاب و ISP' : 'Gaming Mode & ISP',
    alerts: isAr ? 'قواعد التنبيه' : 'Alert Rules',
    ai: t.nav.ai,
    account: isAr ? 'حسابي والسحابة' : 'My Account',
    pricing: isAr ? 'الباقات والاشتراك' : 'Plans & Pricing',
    business: isAr ? 'مساحة الأعمال' : 'Business Workspaces',
    support: isAr ? 'الدعم والسياسات' : 'Support & Legal',
    admin: isAr ? 'لوحة الإدارة' : 'Admin Console',
    settings: t.nav.settings,
    about: t.nav.about,
    apps: t.nav.apps,
  };

  return (
    <header
      dir="ltr"
      className="nv-topbar relative z-40 rounded-[10px] px-2 py-1.5 sm:px-3 sm:py-2 mb-2 bg-transparent border-0 no-print"
    >
      <HeaderAnimatedBackdrop
        isTesting={isTesting}
        animationsEnabled={animationsEnabled}
        animationStyle={animationStyle}
      />

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-2.5">
        {/* Left: Brand Logo & Subtitle (.logo in script) */}
        <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] bg-[#f4f6ff] dark:bg-[#1b1e6a]/55 text-[#141847] dark:text-[#eef0ff]"
        >
          <Menu className="h-5 w-5" />
        </button>

        <NovyraLogo size={54} className="shrink-0 hidden sm:block" />
        <NovyraLogo size={44} className="shrink-0 sm:hidden" />

        <div className="min-w-0 text-left">
          <div className="font-display text-xl sm:text-[28px] xl:text-[32px] font-bold tracking-[1px] text-[#141847] dark:text-[#eef0ff] leading-tight truncate">
            NOVYRA <span className="text-[#0891b2] dark:text-[#18c8ff]">Net</span>
          </div>
          <small
            dir={isAr ? 'rtl' : 'ltr'}
            className="block text-[11px] sm:text-xs text-[#2d3270] dark:text-[#cfd3ff] truncate text-left mt-0.5"
          >
            {t.brandSubtitle}
            {activeSection !== 'overview' && (
              <>
                {' '}
                ·{' '}
                <span className="font-medium text-[#141847] dark:text-white">
                  {pageTitleMap[activeSection]}
                </span>
              </>
            )}
          </small>
        </div>
      </div>

      {/* Right: Transparent Top Controls (.top) + Underlined Slogan (.slogan) */}
      <div className="flex flex-col items-end ml-auto">
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="flex flex-wrap items-center justify-end gap-2 sm:gap-3.5 text-xs sm:text-[14px] text-[#2d3270] dark:text-[#cfd3ff]"
        >
          {/* Quick Test CTA */}
          <button
            type="button"
            onClick={isTesting ? onStopTest : onQuickTest}
            className={`flex h-7 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold text-white transition-all whitespace-nowrap cursor-pointer ${
              isTesting ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'nv-btn-primary'
            }`}
          >
            {isTesting ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{isTesting ? t.topbar.stopTest : t.topbar.quickTest}</span>
          </button>

          {/* Live Connectivity Indicator */}
          <span
            className={`hidden xl:inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
              online
                ? 'text-[#0a9a45] dark:text-[#22e06b]'
                : 'text-[#dc2626] dark:text-[#f06478]'
            }`}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{online ? t.topbar.online : t.topbar.offline}</span>
          </span>

          {/* Plan Badge */}
          <button
            type="button"
            onClick={onOpenPricing}
            className="hidden sm:inline-flex items-center gap-1 font-semibold text-[#4f46e5] dark:text-[#18c8ff] hover:opacity-80 transition-opacity whitespace-nowrap cursor-pointer"
          >
            <Crown className="h-3.5 w-3.5 text-[#f5b942]" />
            <span>{formatPlanLabel(planId, language)}</span>
          </button>

          {/* Account or Sign In */}
          {isSignedIn ? (
            <button
              type="button"
              onClick={onOpenAccount}
              className="inline-flex items-center gap-1.5 font-medium text-[#141847] dark:text-[#eef0ff] hover:text-[#0891b2] dark:hover:text-[#18c8ff] transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserCircle2 className="h-4 w-4 text-[#0891b2] dark:text-[#18c8ff]" />
              <span className="max-w-[96px] truncate">{userDisplayName || (isAr ? 'حسابي' : 'Account')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 font-medium text-[#141847] dark:text-[#eef0ff] hover:text-[#0891b2] dark:hover:text-[#18c8ff] transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogIn className="h-4 w-4 text-[#0891b2] dark:text-[#18c8ff]" />
              <span>{isAr ? 'دخول' : 'Sign In'}</span>
            </button>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label={t.topbar.notifications}
              aria-expanded={notifOpen}
              title={t.topbar.notifications}
              className={`relative flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors cursor-pointer ${
                notifOpen
                  ? 'bg-[#1b1e6a] text-[#18c8ff] border border-[#18c8ff]/50'
                  : 'text-[#cfd3ff] hover:text-white hover:bg-[#1b1e6a]/55'
              }`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f06478] px-1 text-[9px] font-bold text-white font-mono-tabular shadow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                dir={isAr ? 'rtl' : 'ltr'}
                className={`fixed inset-x-3 top-20 sm:inset-x-auto sm:top-full sm:mt-2 sm:w-96 rounded-2xl border border-[#262a6b] bg-[#0d1033]/98 backdrop-blur-md p-4 shadow-2xl z-50 ${
                  isAr ? 'sm:left-0' : 'sm:right-0'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#262a6b]">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#18c8ff]" />
                    <span className="text-sm font-semibold text-[#eef0ff]">
                      {t.topbar.notifications}
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-[#f06478]/15 border border-[#f06478]/40 px-2 py-0.5 text-[10px] font-bold text-[#f06478] font-mono-tabular">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#18c8ff] hover:underline cursor-pointer"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>{t.topbar.markAllRead}</span>
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearNotifications}
                        title={isAr ? 'مسح الكل' : 'Clear all'}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#f06478] hover:underline cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{isAr ? 'مسح' : 'Clear'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 max-h-72 overflow-y-auto space-y-2 pr-0.5">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <Bell className="h-6 w-6 mx-auto text-[#9aa0d6]/50" />
                      <p className="text-xs text-[#9aa0d6]">{t.topbar.noNotifications}</p>
                      <p className="text-[11px] text-[#9aa0d6]/75">
                        {isAr
                          ? 'ستظهر هنا نتائج الاختبارات وتنبيهات انقطاع الاتصال وقواعد التنبيه.'
                          : 'Speed test summaries, disconnect alerts, and custom rule triggers appear here.'}
                      </p>
                    </div>
                  ) : (
                    notifications.slice(0, 15).map((item) => {
                      const SevIcon =
                        item.severity === 'error'
                          ? XCircle
                          : item.severity === 'warning'
                            ? AlertTriangle
                            : Info;
                      const sevColor =
                        item.severity === 'error'
                          ? 'text-[#f06478]'
                          : item.severity === 'warning'
                            ? 'text-[#f5b942]'
                            : 'text-[#18c8ff]';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onMarkRead(item.id)}
                          className={`w-full text-start rounded-xl p-2.5 text-xs border transition-colors cursor-pointer ${
                            item.read
                              ? 'border-[#262a6b]/60 bg-[#0a0d33]/60 opacity-75 hover:opacity-100'
                              : 'border-[#18c8ff]/45 bg-[#18c8ff]/10 hover:bg-[#18c8ff]/15'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <SevIcon className={`h-4 w-4 shrink-0 mt-0.5 ${sevColor}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[#eef0ff] truncate">
                                  {item.title}
                                </span>
                                {!item.read && (
                                  <span className="h-2 w-2 rounded-full bg-[#18c8ff] shrink-0" />
                                )}
                              </div>
                              <div className="mt-0.5 text-[#cfd3ff] leading-relaxed">
                                {item.message}
                              </div>
                              <div className="mt-1 text-[10px] text-[#9aa0d6] font-mono-tabular">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Quick Notification Actions */}
                <div className="mt-3 pt-2.5 border-t border-[#262a6b] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onOpenAlerts();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#262a6b] bg-[#0a0d33] px-2.5 py-1.5 font-semibold text-[#cfd3ff] hover:border-[#18c8ff] hover:text-[#eef0ff] cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3 w-3 text-[#18c8ff]" />
                      <span>{isAr ? 'قواعد التنبيه' : 'Alert Rules'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onOpenSettings();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#262a6b] bg-[#0a0d33] px-2.5 py-1.5 font-semibold text-[#cfd3ff] hover:border-[#18c8ff] hover:text-[#eef0ff] cursor-pointer"
                    >
                      <Settings className="h-3 w-3 text-[#a855f7]" />
                      <span>{isAr ? 'الحدود' : 'Thresholds'}</span>
                    </button>
                  </div>

                  {browserNotifSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        void onRequestBrowserNotifications();
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer ${
                        browserNotifPerm === 'granted'
                          ? 'bg-[#22e06b]/15 border border-[#22e06b]/40 text-[#22e06b]'
                          : 'nv-btn-primary'
                      }`}
                    >
                      <BellRing className="h-3 w-3" />
                      <span>
                        {browserNotifPerm === 'granted'
                          ? isAr
                            ? 'إشعار المتصفح مفعّل'
                            : 'Desktop Alerts On'
                          : isAr
                            ? 'تفعيل إشعارات المتصفح'
                            : 'Enable Desktop Alerts'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Language Switch (.tg) */}
          <button
            type="button"
            onClick={onToggleLanguage}
            title={t.topbar.language}
            className="nv-tg px-3 py-1 text-xs sm:text-[13px] font-semibold text-[#eef0ff] hover:border-[#18c8ff] transition-colors whitespace-nowrap cursor-pointer"
          >
            {language === 'en' ? 'عربي' : 'EN'}
          </button>

          {/* Help & Settings (clean inline items matching .top span in script) */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="hidden sm:inline-flex items-center gap-1.5 text-[#2d3270] dark:text-[#cfd3ff] hover:text-[#141847] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden md:inline">{t.topbar.help}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="hidden sm:inline-flex items-center gap-1.5 text-[#2d3270] dark:text-[#cfd3ff] hover:text-[#141847] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">{t.nav.settings}</span>
          </button>
        </div>

        {/* Slogan (.slogan in script: text-right, margin-top: 14px, font-size: 17px, border-bottom: 2px solid var(--pu), padding-bottom: 4px) */}
        <span
          dir={isAr ? 'rtl' : 'ltr'}
          className="hidden sm:block text-right mt-3.5 text-[15px] sm:text-[17px] border-b-2 border-[#7c3aed] dark:border-[#a855f7] pb-1 text-[#141847] dark:text-[#eef0ff]"
        >
          {t.topbar.slogan}
        </span>
      </div>
      </div>
    </header>
  );
};
