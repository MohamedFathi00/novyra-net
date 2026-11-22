import React from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Cpu,
  Gauge,
  Globe,
  Layers,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { DiagnosticTab, Language, NavSection } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { NovyraLogo } from './NovyraLogo';

interface NovyraAppsViewProps {
  language: Language;
  aiConfigured: boolean;
  onNavigate: (section: NavSection, diagTab?: DiagnosticTab) => void;
}

export const NovyraAppsView: React.FC<NovyraAppsViewProps> = ({
  language,
  aiConfigured,
  onNavigate,
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';
  const ActionArrow = isAr ? ArrowLeft : ArrowRight;

  const modules: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    status: 'active' | 'planned';
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    actionLabel: string;
    onAction: () => void;
  }> = [
    {
      id: 'speed-engine',
      title: isAr ? 'NOVYRA Speed Engine' : 'NOVYRA Speed Engine',
      subtitle: isAr ? 'وحدة قياس النطاق الترددي الفعلي' : 'Real Binary Throughput Benchmark',
      description: isAr
        ? 'قياس سرعة التحميل والرفع بتدفقات متعددة، مع حساب Ping وJitter وفقدان الفحص وزمن الاستجابة تحت الحمل.'
        : 'Multi-stream binary download and upload measurement with HTTP/TCP RTT, jitter, probe loss, and loaded latency.',
      status: 'active',
      badge: t.appsPage.activeNow,
      icon: Gauge,
      accentClass: 'bg-[#18c8ff]/15 text-[#0891b2] dark:text-[#18c8ff]',
      actionLabel: t.appsPage.launchModule,
      onAction: () => onNavigate('speedtest'),
    },
    {
      id: 'live-pulse',
      title: isAr ? 'NOVYRA Live Pulse Monitor' : 'NOVYRA Live Pulse Monitor',
      subtitle: isAr ? 'مراقبة الاستقرار اللحظية' : 'Real-Time Connection Stability',
      description: isAr
        ? 'متابعة مستمرة لزمن الاستجابة وحالة الاتصال ونشاط الفحص النشط عبر نوافذ زمنية من دقيقة إلى ساعة.'
        : 'Continuous live latency probing, connection state tracking, and active transfer graphs across 1m to 1h windows.',
      status: 'active',
      badge: t.appsPage.activeNow,
      icon: Activity,
      accentClass: 'bg-[#22e06b]/15 text-[#0a9a45] dark:text-[#22e06b]',
      actionLabel: t.appsPage.launchModule,
      onAction: () => onNavigate('monitoring'),
    },
    {
      id: 'diag-suite',
      title: isAr ? 'NOVYRA Diagnostics & DNS Lab' : 'NOVYRA Diagnostics & DNS Lab',
      subtitle: isAr ? 'أدوات التشخيص المتقدمة' : 'TCP Ping, DNS & Port Inspector',
      description: isAr
        ? 'فحص اتصال TCP الفعلي، استعلام سجلات DNS (A/AAAA/MX/TXT/CNAME/NS)، اختبار المنافذ، وفحص قدرات تتبع المسار.'
        : 'Backend TCP connect ping, live DNS record resolution, port reachability testing, IP lookup, and traceroute checks.',
      status: 'active',
      badge: t.appsPage.activeNow,
      icon: Wrench,
      accentClass: 'bg-[#a855f7]/15 text-[#7c3aed] dark:text-[#a855f7]',
      actionLabel: t.appsPage.launchModule,
      onAction: () => onNavigate('diagnostics', 'ping'),
    },
    {
      id: 'dns-bench',
      title: isAr ? 'NOVYRA DNS & Edge Matrix' : 'NOVYRA DNS & Edge Matrix',
      subtitle: isAr ? 'مقارنة عقد Anycast العالمية' : 'Global Anycast Edge Probing',
      description: isAr
        ? 'اختبار فعلي لتوافر وزمن استجابة عقد Cloudflare وGoogle وQuad9 مع أدلة تطبيق DNS الآمن على جهازك.'
        : 'Live reachability and latency benchmarks for Cloudflare, Google, and Quad9 edge resolvers plus OS setup guides.',
      status: 'active',
      badge: t.appsPage.activeNow,
      icon: Globe,
      accentClass: 'bg-[#18c8ff]/15 text-[#0891b2] dark:text-[#18c8ff]',
      actionLabel: t.appsPage.launchModule,
      onAction: () => onNavigate('dns'),
    },
    {
      id: 'novyra-ai',
      title: isAr ? 'NOVYRA AI Network Advisor' : 'NOVYRA AI Network Advisor',
      subtitle: isAr ? 'التحليل الذكي عبر Gemini' : 'Server-Side Gemini Diagnostics',
      description: isAr
        ? 'تفسير ذكي لنتائجك الفعلية واكتشاف أسباب التذبذب والـ Ping المرتفع وملاءمة الاتصال للألعاب والبث والعمل.'
        : 'Interprets your real recorded test metrics to diagnose latency spikes, jitter, and gaming/streaming suitability.',
      status: 'active',
      badge: aiConfigured
        ? t.appsPage.activeNow
        : isAr
          ? 'يتطلب مفتاح API'
          : 'Requires API Key',
      icon: Bot,
      accentClass: 'bg-[#6b4dff]/15 text-[#5b3df5] dark:text-[#8b7bff]',
      actionLabel: t.appsPage.launchModule,
      onAction: () => onNavigate('ai'),
    },
    {
      id: 'desktop-agent',
      title: isAr ? 'NOVYRA Desktop Agent (Windows)' : 'NOVYRA Desktop Agent (Windows)',
      subtitle: isAr ? 'وكيل نظام التشغيل Electron IPC' : 'Native Electron IPC Companion',
      description: isAr
        ? 'مخطط مستقبلي لقراءة ICMP Ping الخام، تتبع المسار متعدد القفزات، إشارة Wi-Fi RSSI، واستهلاك بطاقة الشبكة للنظام بالكامل.'
        : 'Planned Electron bridge for native OS raw ICMP ping, multi-hop traceroute, Wi-Fi RSSI signal telemetry, and NIC counters.',
      status: 'planned',
      badge: t.appsPage.plannedDesktop,
      icon: Cpu,
      accentClass: 'bg-[#ff8a3d]/15 text-[#d97706] dark:text-[#ff8a3d]',
      actionLabel: t.appsPage.viewArchitecture,
      onAction: () => onNavigate('about'),
    },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <section className="nv-card p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <NovyraLogo size={54} className="shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141847] dark:text-[#eef0ff]">
              {t.appsPage.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff] mt-1">
              {t.appsPage.subtitle}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#22e06b]/40 bg-[#22e06b]/10 px-3 py-1.5 text-xs font-semibold text-[#0a9a45] dark:text-[#22e06b] shrink-0">
          <Layers className="h-4 w-4" />
          <span>NOVYRA Innovative Solutions</span>
        </span>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <section
              key={mod.id}
              className="nv-card p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${mod.accentClass}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      mod.status === 'active'
                        ? 'bg-[#22e06b]/15 text-[#0a9a45] dark:text-[#22e06b]'
                        : 'bg-[#ff8a3d]/15 text-[#d97706] dark:text-[#ff8a3d]'
                    }`}
                  >
                    {mod.badge}
                  </span>
                </div>

                <h3 className="font-display text-base sm:text-lg font-bold text-[#141847] dark:text-[#eef0ff] mt-3.5">
                  {mod.title}
                </h3>
                <p className="text-xs font-medium text-[#0891b2] dark:text-[#18c8ff] mt-0.5">
                  {mod.subtitle}
                </p>
                <p className="text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff] mt-2.5 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              <button
                type="button"
                onClick={mod.onAction}
                className={`flex items-center justify-center gap-2 w-full rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                  mod.status === 'active'
                    ? 'nv-btn-primary'
                    : 'nv-inner text-[#141847] dark:text-[#eef0ff] hover:border-[#18c8ff]'
                }`}
              >
                <span>{mod.actionLabel}</span>
                <ActionArrow className="h-4 w-4" />
              </button>
            </section>
          );
        })}
      </div>

      <section className="nv-inner p-4 sm:p-5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[#0891b2] dark:text-[#18c8ff] shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff] leading-relaxed">
          <div className="font-bold text-[#141847] dark:text-[#eef0ff] mb-0.5">
            {t.appsPage.suiteNoteTitle}
          </div>
          {t.appsPage.suiteNoteDesc}
        </div>
      </section>
    </div>
  );
};
