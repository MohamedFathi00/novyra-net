import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  CreditCard,
  Gamepad2,
  Gauge,
  Globe,
  History,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Settings,
  ShieldCheck,
  UserCircle2,
  Wrench,
  X,
} from 'lucide-react';
import type { AnimationStyle, Language, NavSection } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { NovyraLogo } from './NovyraLogo';
import { SidebarBrandBackdrop } from './SidebarBrandBackdrop';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  language: Language;
  isAdmin: boolean;
  animationsEnabled?: boolean;
  animationStyle?: AnimationStyle;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  language,
  isAdmin,
  animationsEnabled = true,
  animationStyle = 'cyber',
}) => {
  const t = getTranslations(language);
  const isRtl = language === 'ar';
  const [slogoError, setSlogoError] = useState(false);

  const primaryItems: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: t.nav.overview, icon: LayoutDashboard },
    { id: 'speedtest', label: t.nav.speedtest, icon: Gauge },
    { id: 'monitoring', label: t.nav.monitoring, icon: Activity },
    { id: 'diagnostics', label: t.nav.diagnostics, icon: Wrench },
    { id: 'info', label: t.nav.info, icon: Cpu },
    { id: 'dns', label: t.nav.dns, icon: Globe },
    { id: 'history', label: t.nav.history, icon: History },
    { id: 'analytics', label: t.nav.analytics, icon: BarChart3 },
    { id: 'gaming', label: isRtl ? 'وضع الألعاب و ISP' : 'Gaming & ISP', icon: Gamepad2 },
    { id: 'alerts', label: isRtl ? 'التنبيهات الذكية' : 'Alert Rules', icon: Bell },
    { id: 'ai', label: t.nav.ai, icon: Bot },
  ];

  const commercialItems: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'account', label: isRtl ? 'حسابي والسحابة' : 'My Account', icon: UserCircle2 },
    { id: 'pricing', label: isRtl ? 'الباقات والاشتراك' : 'Plans & Billing', icon: CreditCard },
    { id: 'business', label: isRtl ? 'مساحة الأعمال' : 'Business Teams', icon: Building2 },
    ...(isAdmin
      ? [{ id: 'admin' as NavSection, label: isRtl ? 'لوحة الإدارة' : 'Admin Console', icon: ShieldCheck }]
      : []),
  ];

  const secondaryItems: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'support', label: isRtl ? 'الدعم والقانونية' : 'Support & Legal', icon: LifeBuoy },
    { id: 'settings', label: t.nav.settings, icon: Settings },
    { id: 'about', label: t.nav.about, icon: Info },
    { id: 'apps', label: t.nav.apps, icon: LayoutGrid },
  ];

  const CollapseIcon = isRtl
    ? collapsed
      ? ChevronLeft
      : ChevronRight
    : collapsed
      ? ChevronRight
      : ChevronLeft;

  const renderNavButton = (item: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onSelectSection(item.id);
          onCloseMobile();
        }}
        title={collapsed ? item.label : undefined}
        className={`group flex w-full items-center gap-3 rounded-[14px] px-3 py-[7px] ${
          item.id === 'apps' ? 'text-[13px]' : 'text-[14px]'
        } font-medium transition-all whitespace-nowrap ${
          collapsed ? 'justify-center px-2' : ''
        } ${
          isActive
            ? 'nv-nav-active'
            : 'text-[#4c538c] hover:bg-[#e5e9ff]/85 hover:text-[#141847] dark:text-[#cfd3ff] dark:hover:bg-[#1b1e6a]/55 dark:hover:text-white'
        }`}
      >
        <Icon
          className={`h-4.5 w-4.5 shrink-0 transition-colors ${
            isActive
              ? 'text-white'
              : 'text-[#5a6099] group-hover:text-[#0891b2] dark:text-[#9aa0d6] dark:group-hover:text-[#18c8ff]'
          }`}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/45 dark:bg-[#050618]/75 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`nv-sidebar fixed inset-y-0 start-0 z-50 flex flex-col overflow-y-auto lg:overflow-hidden transition-all duration-200 lg:static lg:translate-x-0 lg:rounded-xl lg:p-2 ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-[210px]'
        } ${
          mobileOpen
            ? 'w-64 translate-x-0'
            : isRtl
              ? 'w-64 translate-x-full lg:translate-x-0'
              : 'w-64 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-3 lg:px-1 lg:py-1 border-b border-[#c4cbf2] dark:border-[#262a6b] lg:border-b-0">
          <div className="flex items-center gap-2.5 lg:hidden min-w-0">
            <NovyraLogo size={34} className="shrink-0" />
            <span className="font-display text-sm font-bold text-[#141847] dark:text-[#eef0ff] truncate">
              {t.brandName}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex ms-auto h-7 w-7 items-center justify-center rounded-lg border border-[#c4cbf2] dark:border-[#262a6b] bg-white/85 dark:bg-[#10134a]/80 text-[#4c538c] dark:text-[#cfd3ff] hover:text-[#141847] dark:hover:text-white hover:border-[#4f46e5]/60 dark:hover:border-[#18c8ff]/60 transition-colors"
          >
            <CollapseIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[#4c538c] dark:text-[#cfd3ff] hover:bg-[#e5e9ff] dark:hover:bg-[#1b1e6a]/55 hover:text-[#141847] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="relative z-10 flex-none overflow-y-auto px-2 lg:px-0 py-0.5 space-y-0.5">
          {primaryItems.map(renderNavButton)}
          <div className="my-2 border-t border-[#c4cbf2] dark:border-[#262a6b]" />
          {commercialItems.map(renderNavButton)}
          <div className="my-2 border-t border-[#c4cbf2] dark:border-[#262a6b]" />
          {secondaryItems.map(renderNavButton)}
        </nav>

        {!collapsed && (
          <div
            className={`group relative z-10 flex-1 min-h-[195px] mt-2 -mx-2.5 -mb-2.5 px-4 pt-5 pb-6 flex flex-col items-center justify-center text-center overflow-hidden rounded-b-2xl ${
              animationsEnabled ? '' : 'nv-header-paused'
            }`}
          >
            <SidebarBrandBackdrop
              animationsEnabled={animationsEnabled}
              animationStyle={animationStyle}
            />

            {!slogoError ? (
              <div className="relative z-10 flex flex-col items-center justify-center transition-transform duration-300 group-hover:scale-[1.03]">
                {/* Soft breathing cyan-violet halo anchored behind the N mark */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-gradient-to-tr from-[#18c8ff]/30 via-[#4f46e5]/25 to-[#a855f7]/30 blur-xl nv-logo-halo"
                />

                {/* Emblem lockup with smooth levitation & crisp contrast shadow */}
                <div className="relative drop-shadow-[0_4px_10px_rgba(20,24,71,0.38)] dark:drop-shadow-[0_4px_14px_rgba(24,200,255,0.28)]">
                  <img
                    src="/assets/novyra-slogo.webp"
                    alt="NOVYRA"
                    referrerPolicy="no-referrer"
                    onError={() => setSlogoError(true)}
                    className="nv-slogo w-[134px] max-w-full h-auto mx-auto select-none"
                    draggable={false}
                  />
                </div>

                {/* Clean centered tagline & luminous accent hairline */}
                <div className="mt-2.5 flex flex-col items-center gap-1.5">
                  <div className="text-[11px] font-medium tracking-[0.15em] text-[#4c538c] dark:text-[#cfd3ff]/90">
                    Innovative Solutions
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-[1.5px] w-14 rounded-full bg-gradient-to-r from-transparent via-[#0891b2] dark:via-[#18c8ff] to-transparent opacity-80"
                  />
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="flex justify-center mb-2">
                  <NovyraLogo size={46} />
                </div>
                <div className="font-display text-base font-bold tracking-[0.22em] text-[#141847] dark:text-[#eef0ff]">
                  NOVYRA
                </div>
                <div className="text-[11px] text-[#5a6099] dark:text-[#9aa0d6] mt-0.5">
                  Innovative Solutions
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
