import React from 'react';
import { CheckCircle2, Cpu, ShieldCheck } from 'lucide-react';
import type { Language } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { NovyraLogo } from './NovyraLogo';

interface AboutViewProps {
  language: Language;
}

export const AboutView: React.FC<AboutViewProps> = ({ language }) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';

  const webFeatures = isAr
    ? [
        'قياس سرعة التحميل والرفع الفعلي عبر تدفقات بيانات ثنائية متعددة',
        'قياس زمن الاستجابة (HTTP/TCP RTT) في الخمول وتحت الحمل والتذبذب وفقدان الفحص',
        'مراقبة لحظية بنوافذ زمنية حقيقية (1m / 5m / 15m / 30m / 1h)',
        'فحص TCP Ping، استعلام سجلات DNS الحقيقية، وفحص المنافذ من الخادم',
        'سجل محلي دائم، تحليلات مقارنة، وتصدير تقارير CSV / JSON / PDF',
        'مستشار NOVYRA AI لتحليل الشبكة عبر خادم Gemini',
      ]
    : [
        'Multi-stream HTTP binary download & upload throughput benchmarking',
        'HTTP/TCP RTT idle & loaded latency, jitter, and probe loss calculation',
        'Live probe monitoring with 1m / 5m / 15m / 30m / 1h history windows',
        'Backend TCP Connect Ping, Port Reachability, and DNS Record Resolver',
        'Local history persistence, analytics, CSV/JSON/Print PDF exports',
        'Server-side NOVYRA AI Network Advisor powered by Gemini',
      ];

  const desktopAdapterFeatures = isAr
    ? [
        'ICMP Echo Ping الخام وتتبع المسار متعدد القفزات (Traceroute) على مستوى النظام',
        'عدادات بطاقة الشبكة (NIC Rx/Tx) لمراقبة استهلاك النظام بالكامل',
        'قراءة اسم شبكة Wi-Fi والقناة وسرعة الربط وقوة الإشارة (RSSI)',
        'اكتشاف البوابة الافتراضية وجدول ARP وإشعارات سطح المكتب الأصلية',
      ]
    : [
        'Native OS raw ICMP Echo Ping & multi-hop ICMP/UDP Traceroute',
        'System-wide NIC Rx/Tx byte throughput counters across all processes',
        'Hardware Wi-Fi SSID, channel, link rate, and signal RSSI telemetry',
        'Default gateway / router ARP discovery & native OS toast alerts',
      ];

  return (
    <div className="space-y-5 max-w-4xl">
      <section className="nv-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <NovyraLogo size={56} className="shrink-0" />
        <div>
          <h2 className="font-display text-2xl font-bold text-[#141847] dark:text-[#eef0ff]">
            {t.brandName}
          </h2>
          <p className="text-sm font-medium text-[#0891b2] dark:text-[#18c8ff] mt-0.5">
            {t.tagline}
          </p>
          <p className="text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff] mt-2 leading-relaxed">
            {t.aboutPage.subtitle}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="nv-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0a9a45] dark:text-[#22e06b]" />
            <h3 className="font-display text-sm sm:text-base font-bold text-[#141847] dark:text-[#eef0ff]">
              {t.aboutPage.browserSupported}
            </h3>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff]">
            {webFeatures.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0a9a45] dark:text-[#22e06b] shrink-0 mt-1" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="nv-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#0891b2] dark:text-[#18c8ff]" />
            <h3 className="font-display text-sm sm:text-base font-bold text-[#141847] dark:text-[#eef0ff]">
              {t.aboutPage.desktopFuture}
            </h3>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff]">
            {desktopAdapterFeatures.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Cpu className="h-3.5 w-3.5 text-[#0891b2] dark:text-[#18c8ff] shrink-0 mt-1" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="nv-inner p-4 text-xs sm:text-sm text-[#4c538c] dark:text-[#cfd3ff] leading-relaxed">
        {t.aboutPage.architectureNote}
      </section>
    </div>
  );
};
