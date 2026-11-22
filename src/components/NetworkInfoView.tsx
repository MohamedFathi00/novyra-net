import React from 'react';
import { Cpu, Globe, RefreshCw, Shield, Wifi } from 'lucide-react';
import type { ConnectionInfo, Language } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { getPlatformCapabilities } from '../services/desktopAdapter';

interface NetworkInfoViewProps {
  language: Language;
  connectionInfo: ConnectionInfo;
  onRefresh: () => void;
}

export const NetworkInfoView: React.FC<NetworkInfoViewProps> = ({
  language,
  connectionInfo,
  onRefresh,
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';
  const caps = getPlatformCapabilities();

  const cards = [
    { label: t.topbar.online + ' / ' + t.common.status, value: connectionInfo.online ? t.topbar.online : t.topbar.offline },
    { label: t.dashboard.networkType, value: connectionInfo.connectionType || connectionInfo.effectiveType || t.dashboard.unavailable },
    { label: isAr ? 'عنوان IPv4 العام' : 'Public IPv4', value: connectionInfo.publicIpv4 || t.dashboard.unavailable },
    { label: isAr ? 'عنوان IPv6 العام' : 'Public IPv6', value: connectionInfo.publicIpv6 || t.dashboard.unavailable },
    { label: isAr ? 'IP المرصود من الخادم' : 'Server Observed IP', value: connectionInfo.serverObservedIp || t.dashboard.unavailable },
    { label: t.dashboard.localIp, value: connectionInfo.localIp || t.dashboard.unavailable },
    { label: t.dashboard.isp, value: connectionInfo.isp || t.dashboard.unavailable },
    { label: 'ASN', value: connectionInfo.asn || t.dashboard.unavailable },
    {
      label: isAr ? 'الموقع الجغرافي' : 'Geography',
      value:
        connectionInfo.city || connectionInfo.country
          ? [connectionInfo.city, connectionInfo.country].filter(Boolean).join(', ')
          : t.dashboard.unavailable,
    },
    { label: isAr ? 'المنطقة الزمنية' : 'Timezone', value: connectionInfo.timezone || t.dashboard.unavailable },
    {
      label: isAr ? 'تقدير سرعة المتصفح' : 'Browser Downlink Estimate',
      value: connectionInfo.downlinkEstimateMbps !== null ? `${connectionInfo.downlinkEstimateMbps} Mbps` : t.dashboard.unavailable,
    },
    {
      label: isAr ? 'تقدير RTT من المتصفح' : 'Browser RTT Hint',
      value: connectionInfo.rttEstimateMs !== null ? `${connectionInfo.rttEstimateMs} ms` : t.dashboard.unavailable,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F7FF]">
            {t.nav.info}
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#9EACC4] mt-0.5">
            {t.diagnosticsPage.browserApiNote}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#263650] bg-white dark:bg-[#121D32] px-4 py-2 text-xs font-semibold text-[#069FC7] dark:text-[#08C8F0] hover:bg-slate-50 dark:hover:bg-[#192640]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${connectionInfo.isLoadingPublicIp ? 'animate-spin' : ''}`} />
          <span>{t.dashboard.refreshInfo}</span>
        </button>
      </div>

      {connectionInfo.lookupError && (
        <div className="rounded-xl border border-[#F5B942]/30 bg-[#F5B942]/10 p-3.5 text-xs text-slate-800 dark:text-[#F4F7FF]">
          {connectionInfo.lookupError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((item) => (
          <div
            key={item.label}
            className="nv-card p-4"
          >
            <div className="text-xs text-slate-500 dark:text-[#9EACC4]">{item.label}</div>
            <div className="mt-1.5 text-base font-bold font-mono-tabular text-slate-900 dark:text-[#F4F7FF] break-all">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Runtime Environment Capability Matrix */}
      <section className="nv-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4 text-[#08C8F0]" />
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
            {t.aboutPage.capabilitiesTitle}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { name: isAr ? 'اختبار السرعة عبر HTTP' : 'HTTP Speed Benchmark', ok: caps.httpSpeedBenchmark, icon: Globe },
            { name: isAr ? 'تشخيص TCP و DNS' : 'TCP & DNS Diagnostics', ok: caps.tcpConnectDiagnostics, icon: Shield },
            { name: isAr ? 'بيانات عتاد Wi-Fi (SSID/RSSI)' : 'Wi-Fi SSID / RSSI Hardware', ok: caps.wifiHardwareMetrics, icon: Wifi },
            { name: isAr ? 'عدادات كرت الشبكة بالنظام' : 'OS NIC Byte Counters', ok: caps.systemTrafficMonitor, icon: Cpu },
          ].map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.name}
                className="rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-3 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-[#08C8F0] shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-[#F4F7FF] truncate">{cap.name}</span>
                </div>
                <span className={`font-semibold shrink-0 ${cap.ok ? 'text-[#22C58B]' : 'text-slate-400'}`}>
                  {cap.ok ? (isAr ? 'مفعّل' : 'Active') : isAr ? 'سطح المكتب فقط' : 'Desktop Only'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
