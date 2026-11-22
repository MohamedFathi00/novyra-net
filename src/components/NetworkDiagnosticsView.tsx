import React, { useEffect, useState } from 'react';
import {
  Activity,
  Globe,
  Info,
  RefreshCw,
  Router,
  Server,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import type {
  ConnectionInfo,
  DiagnosticTab,
  DnsLookupResult,
  Language,
  PortCheckResult,
  TcpPingResult,
  TracerouteResult,
} from '../types/network';
import { getTranslations } from '../i18n/translations';
import {
  fetchTracerouteCapability,
  lookupDns,
  runPortCheckDiagnostic,
  runTcpPingDiagnostic,
  runTracerouteDiagnostic,
} from '../services/diagnosticsService';
import { ErrorState } from './FeedbackUI';

interface NetworkDiagnosticsViewProps {
  language: Language;
  activeTab: DiagnosticTab;
  onChangeTab: (tab: DiagnosticTab) => void;
  connectionInfo: ConnectionInfo;
  onRefreshConnectionInfo: () => void;
}

export const NetworkDiagnosticsView: React.FC<NetworkDiagnosticsViewProps> = ({
  language,
  activeTab,
  onChangeTab,
  connectionInfo,
  onRefreshConnectionInfo,
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';

  // Ping Tool state
  const [pingHost, setPingHost] = useState('cloudflare.com');
  const [pingPort, setPingPort] = useState(443);
  const [pingCount, setPingCount] = useState(4);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<TcpPingResult | null>(null);

  // DNS Checker state
  const [dnsDomain, setDnsDomain] = useState('cloudflare.com');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [dnsResult, setDnsResult] = useState<DnsLookupResult | null>(null);

  // Port Checker state
  const [portHost, setPortHost] = useState('github.com');
  const [portNum, setPortNum] = useState(443);
  const [portLoading, setPortLoading] = useState(false);
  const [portError, setPortError] = useState<string | null>(null);
  const [portResult, setPortResult] = useState<PortCheckResult | null>(null);

  // Traceroute state
  const [traceHost, setTraceHost] = useState('1.1.1.1');
  const [traceCap, setTraceCap] = useState<{ available: boolean; command: string | null; reason: string } | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceResult, setTraceResult] = useState<TracerouteResult | null>(null);

  useEffect(() => {
    if (activeTab === 'traceroute' && !traceCap) {
      fetchTracerouteCapability()
        .then(setTraceCap)
        .catch(() => {});
    }
  }, [activeTab, traceCap]);

  const handleRunPing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPingLoading(true);
    setPingError(null);
    try {
      const res = await runTcpPingDiagnostic(pingHost, pingPort, pingCount);
      setPingResult(res);
    } catch (err) {
      setPingError(err instanceof Error ? err.message : isAr ? 'فشل طلب Ping.' : 'Ping request failed.');
    } finally {
      setPingLoading(false);
    }
  };

  const handleRunDns = async (e: React.FormEvent) => {
    e.preventDefault();
    setDnsLoading(true);
    setDnsError(null);
    try {
      const res = await lookupDns(dnsDomain);
      setDnsResult(res);
    } catch (err) {
      setDnsError(err instanceof Error ? err.message : isAr ? 'فشل استعلام DNS.' : 'DNS lookup failed.');
    } finally {
      setDnsLoading(false);
    }
  };

  const handleRunPortCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortLoading(true);
    setPortError(null);
    try {
      const res = await runPortCheckDiagnostic(portHost, portNum);
      setPortResult(res);
    } catch (err) {
      setPortError(err instanceof Error ? err.message : isAr ? 'فشل فحص المنفذ.' : 'Port check failed.');
    } finally {
      setPortLoading(false);
    }
  };

  const handleRunTraceroute = async (e: React.FormEvent) => {
    e.preventDefault();
    setTraceLoading(true);
    setTraceError(null);
    try {
      const res = await runTracerouteDiagnostic(traceHost);
      setTraceResult(res);
    } catch (err) {
      setTraceError(err instanceof Error ? err.message : isAr ? 'فشل تتبع المسار.' : 'Traceroute failed.');
    } finally {
      setTraceLoading(false);
    }
  };

  const tabs: Array<{ id: DiagnosticTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'ping', label: t.tools.pingTool, icon: Activity },
    { id: 'dns', label: t.tools.dnsChecker, icon: Server },
    { id: 'ip', label: t.tools.networkInfo, icon: Globe },
    { id: 'ports', label: t.tools.portChecker, icon: ShieldCheck },
    { id: 'traceroute', label: t.tools.traceroute, icon: Waypoints },
    { id: 'router', label: t.tools.routerInfo, icon: Router },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F7FF]">
          {t.diagnosticsPage.title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-[#9EACC4] mt-0.5">
          {t.diagnosticsPage.subtitle}
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex flex-wrap items-center gap-1.5 nv-card p-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-r from-[#08C8F0] to-[#6555FF] text-white'
                  : 'text-slate-600 dark:text-[#9EACC4] hover:bg-slate-100 dark:hover:bg-[#192640]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PING TOOL */}
      {activeTab === 'ping' && (
        <section className="nv-card p-5 space-y-5">
          <p className="text-xs text-slate-600 dark:text-[#9EACC4]">{t.diagnosticsPage.pingDesc}</p>

          <form onSubmit={handleRunPing} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-600 dark:text-[#9EACC4] mb-1">
                {isAr ? 'المضيف / IP العام' : 'Host / Public IP'}
              </label>
              <input
                type="text"
                value={pingHost}
                onChange={(e) => setPingHost(e.target.value)}
                placeholder={t.diagnosticsPage.hostPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2 text-sm text-slate-900 dark:text-[#F4F7FF] focus:outline-none focus:ring-2 focus:ring-[#08C8F0]/50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-[#9EACC4] mb-1">
                {t.diagnosticsPage.portLabel}
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={pingPort}
                onChange={(e) => setPingPort(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-[#F4F7FF]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-[#9EACC4] mb-1">
                {t.diagnosticsPage.countLabel}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={pingCount}
                onChange={(e) => setPingCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-[#F4F7FF]"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pingLoading}
                className="w-full rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                {pingLoading ? t.diagnosticsPage.running : t.diagnosticsPage.run}
              </button>
            </div>
          </form>

          {pingError && <ErrorState title={isAr ? 'خطأ في فحص Ping' : 'Ping Error'} message={pingError} />}

          {pingResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-3">
                  <div className="text-[11px] text-slate-500">{isAr ? 'IP المُحلَّل' : 'Resolved IP'}</div>
                  <div className="mt-1 text-sm font-bold font-mono-tabular text-slate-900 dark:text-[#F4F7FF]">
                    {pingResult.resolvedIp}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-3">
                  <div className="text-[11px] text-slate-500">{isAr ? 'متوسط RTT' : 'Avg RTT'}</div>
                  <div className="mt-1 text-sm font-bold font-mono-tabular text-[#08C8F0]">
                    {pingResult.summary.avgMs !== null ? `${pingResult.summary.avgMs} ms` : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-3">
                  <div className="text-[11px] text-slate-500">{isAr ? 'الأدنى / الأعلى' : 'Min / Max'}</div>
                  <div className="mt-1 text-sm font-bold font-mono-tabular text-slate-900 dark:text-[#F4F7FF]">
                    {pingResult.summary.minMs ?? '—'} / {pingResult.summary.maxMs ?? '—'} ms
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-3">
                  <div className="text-[11px] text-slate-500">{isAr ? 'تذبذب الجيتر' : 'Jitter'}</div>
                  <div className="mt-1 text-sm font-bold font-mono-tabular text-slate-900 dark:text-[#F4F7FF]">
                    {pingResult.summary.jitterMs !== null ? `${pingResult.summary.jitterMs} ms` : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-3">
                  <div className="text-[11px] text-slate-500">{isAr ? 'فقدان TCP' : 'TCP Loss'}</div>
                  <div className="mt-1 text-sm font-bold font-mono-tabular text-slate-900 dark:text-[#F4F7FF]">
                    {pingResult.summary.lossPercent}% ({pingResult.summary.failed} {isAr ? 'فاشل' : 'failed'})
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#263650]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-[#0E1628] text-slate-500 dark:text-[#9EACC4]">
                    <tr>
                      <th className="px-4 py-2.5 text-start font-medium">#</th>
                      <th className="px-4 py-2.5 text-start font-medium">{isAr ? 'الطريقة' : 'Method'}</th>
                      <th className="px-4 py-2.5 text-start font-medium">{t.common.status}</th>
                      <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'زمن الاستجابة (RTT)' : 'RTT'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#263650]/70">
                    {pingResult.attempts.map((a) => (
                      <tr key={a.seq}>
                        <td className="px-4 py-2 font-mono-tabular">{a.seq}</td>
                        <td className="px-4 py-2">{pingResult.method} (:{pingResult.port})</td>
                        <td className={`px-4 py-2 font-semibold ${a.success ? 'text-[#22C58B]' : 'text-[#F06478]'}`}>
                          {a.success ? (isAr ? 'متصل' : 'Connected') : a.error || (isAr ? 'فشل' : 'Failed')}
                        </td>
                        <td className="px-4 py-2 text-end font-mono-tabular">
                          {a.rttMs !== null ? `${a.rttMs} ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* DNS CHECKER */}
      {activeTab === 'dns' && (
        <section className="nv-card p-5 space-y-5">
          <p className="text-xs text-slate-600 dark:text-[#9EACC4]">{t.diagnosticsPage.dnsDesc}</p>

          <form onSubmit={handleRunDns} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={dnsDomain}
              onChange={(e) => setDnsDomain(e.target.value)}
              placeholder={t.diagnosticsPage.domainPlaceholder}
              className="flex-1 rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2 text-sm text-slate-900 dark:text-[#F4F7FF]"
            />
            <button
              type="submit"
              disabled={dnsLoading}
              className="rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-6 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {dnsLoading ? t.diagnosticsPage.running : t.diagnosticsPage.run}
            </button>
          </form>

          {dnsError && <ErrorState title={isAr ? 'خطأ في فحص DNS' : 'DNS Lookup Error'} message={dnsError} />}

          {dnsResult && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-[#9EACC4] font-mono-tabular">
                {isAr ? 'النطاق:' : 'Domain:'}{' '}
                <strong className="text-slate-900 dark:text-[#F4F7FF]">{dnsResult.domain}</strong> ·{' '}
                {isAr ? 'زمن الحل:' : 'Resolution time:'} {dnsResult.durationMs} ms
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'] as const).map((type) => {
                  const list = dnsResult.records[type];
                  const errMsg = dnsResult.errors[type];
                  return (
                    <div
                      key={type}
                      className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50/70 dark:bg-[#0E1628]/80 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono-tabular text-xs font-bold text-[#069FC7] dark:text-[#08C8F0]">
                          {isAr ? `سجلات ${type}` : `${type} Records`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono-tabular">
                          {list
                            ? isAr
                              ? `${list.length} سجل`
                              : `${list.length} found`
                            : errMsg || (isAr ? 'لا يوجد' : 'None')}
                        </span>
                      </div>
                      {list && list.length > 0 ? (
                        <ul className="space-y-1 text-xs font-mono-tabular text-slate-800 dark:text-[#F4F7FF] break-all">
                          {list.map((entry, idx) => (
                            <li key={idx} className="py-0.5">
                              {typeof entry === 'string' ? entry : JSON.stringify(entry)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-[#9EACC4]">
                          {errMsg || (isAr ? 'لم يتم العثور على سجلات.' : 'No records returned.')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* IP INFORMATION */}
      {activeTab === 'ip' && (
        <section className="nv-card p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
              {t.diagnosticsPage.ipLookupTitle}
            </h3>
            <button
              type="button"
              onClick={onRefreshConnectionInfo}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#263650] px-3 py-1.5 text-xs font-semibold text-[#069FC7] dark:text-[#08C8F0] hover:bg-slate-50 dark:hover:bg-[#192640]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${connectionInfo.isLoadingPublicIp ? 'animate-spin' : ''}`} />
              <span>{t.diagnosticsPage.enableLookupBtn}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {[
              [isAr ? 'عنوان IPv4 العام' : 'Public IPv4', connectionInfo.publicIpv4 || t.dashboard.unavailable],
              [isAr ? 'عنوان IPv6 العام' : 'Public IPv6', connectionInfo.publicIpv6 || t.dashboard.unavailable],
              [isAr ? 'عنوان IP المرصود من الخادم' : 'Server Observed IP', connectionInfo.serverObservedIp || t.dashboard.unavailable],
              [isAr ? 'عنوان الشبكة المحلية (WebRTC)' : 'Local LAN IP (WebRTC)', connectionInfo.localIp || t.dashboard.unavailable],
              [isAr ? 'مزود الخدمة / المؤسسة' : 'ISP / Organization', connectionInfo.isp || t.dashboard.unavailable],
              ['ASN', connectionInfo.asn || t.dashboard.unavailable],
              [
                isAr ? 'الموقع التقريبي' : 'Approx. Location',
                connectionInfo.city || connectionInfo.country
                  ? [connectionInfo.city, connectionInfo.country].filter(Boolean).join(', ')
                  : t.dashboard.unavailable,
              ],
              [isAr ? 'نوع الاتصال' : 'Connection Type', connectionInfo.connectionType || connectionInfo.effectiveType || t.dashboard.unavailable],
              [
                isAr ? 'تقدير سرعة المتصفح' : 'Browser Downlink Hint',
                connectionInfo.downlinkEstimateMbps ? `${connectionInfo.downlinkEstimateMbps} Mbps` : t.dashboard.unavailable,
              ],
            ].map(([label, val]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50/70 dark:bg-[#0E1628]/80 p-3.5"
              >
                <div className="text-slate-500 dark:text-[#9EACC4]">{label}</div>
                <div className="mt-1 text-sm font-bold font-mono-tabular text-slate-900 dark:text-[#F4F7FF] break-all">
                  {val}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500 dark:text-[#9EACC4] flex items-start gap-2">
            <Info className="h-4 w-4 text-[#08C8F0] shrink-0 mt-0.5" />
            <span>{t.diagnosticsPage.browserApiNote}</span>
          </div>
        </section>
      )}

      {/* PORT CHECKER */}
      {activeTab === 'ports' && (
        <section className="nv-card p-5 space-y-5">
          <p className="text-xs text-slate-600 dark:text-[#9EACC4]">{t.diagnosticsPage.portDesc}</p>

          <form onSubmit={handleRunPortCheck} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-7">
              <label className="block text-xs font-medium text-slate-600 dark:text-[#9EACC4] mb-1">
                {isAr ? 'المضيف / IP العام' : 'Host / Public IP'}
              </label>
              <input
                type="text"
                value={portHost}
                onChange={(e) => setPortHost(e.target.value)}
                placeholder={t.diagnosticsPage.hostPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2 text-sm text-slate-900 dark:text-[#F4F7FF]"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-[#9EACC4] mb-1">
                {t.diagnosticsPage.portLabel}
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={portNum}
                onChange={(e) => setPortNum(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-[#F4F7FF]"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={portLoading}
                className="w-full rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                {portLoading ? t.diagnosticsPage.running : t.diagnosticsPage.run}
              </button>
            </div>
          </form>

          {portError && (
            <ErrorState title={isAr ? 'خطأ في فحص المنفذ' : 'Port Check Error'} message={portError} />
          )}

          {portResult && (
            <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-slate-500">{isAr ? 'الهدف' : 'Target'}</div>
                <div className="mt-1 font-mono-tabular font-bold text-slate-900 dark:text-[#F4F7FF]">
                  {portResult.host}:{portResult.port}
                </div>
              </div>
              <div>
                <div className="text-slate-500">{isAr ? 'IP المحلول' : 'Resolved IP'}</div>
                <div className="mt-1 font-mono-tabular font-bold text-slate-900 dark:text-[#F4F7FF]">
                  {portResult.resolvedIp}
                </div>
              </div>
              <div>
                <div className="text-slate-500">{isAr ? 'حالة TCP' : 'TCP State'}</div>
                <div
                  className={`mt-1 font-bold uppercase ${
                    portResult.status === 'open'
                      ? 'text-[#22C58B]'
                      : portResult.status === 'closed'
                        ? 'text-[#F06478]'
                        : 'text-[#F5B942]'
                  }`}
                >
                  {isAr
                    ? portResult.status === 'open'
                      ? 'مفتوح'
                      : portResult.status === 'closed'
                        ? 'مغلق'
                        : 'انتهت المهلة'
                    : portResult.status}
                </div>
              </div>
              <div>
                <div className="text-slate-500">{isAr ? 'تفاصيل الاتصال' : 'Handshake Detail'}</div>
                <div className="mt-1 font-mono-tabular text-slate-700 dark:text-[#9EACC4]">
                  {portResult.rttMs !== null ? `${portResult.rttMs} ms · ` : ''}
                  {portResult.detail}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TRACEROUTE */}
      {activeTab === 'traceroute' && (
        <section className="nv-card p-5 space-y-5">
          <p className="text-xs text-slate-600 dark:text-[#9EACC4]">{t.diagnosticsPage.tracerouteDesc}</p>

          {traceCap && (
            <div
              className={`rounded-xl border p-3.5 text-xs flex items-start gap-2.5 ${
                traceCap.available
                  ? 'border-[#22C58B]/30 bg-[#22C58B]/10 text-slate-800 dark:text-[#F4F7FF]'
                  : 'border-[#F5B942]/30 bg-[#F5B942]/10 text-slate-800 dark:text-[#F4F7FF]'
              }`}
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#F5B942]" />
              <span>{traceCap.reason}</span>
            </div>
          )}

          <form onSubmit={handleRunTraceroute} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={traceHost}
              onChange={(e) => setTraceHost(e.target.value)}
              placeholder={t.diagnosticsPage.hostPlaceholder}
              className="flex-1 rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2 text-sm text-slate-900 dark:text-[#F4F7FF]"
            />
            <button
              type="submit"
              disabled={traceLoading}
              className="rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-6 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {traceLoading ? t.diagnosticsPage.running : t.diagnosticsPage.run}
            </button>
          </form>

          {traceError && (
            <ErrorState title={isAr ? 'خطأ في تتبع المسار' : 'Traceroute Error'} message={traceError} />
          )}

          {traceResult && !traceResult.supported && (
            <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-4 text-xs text-slate-600 dark:text-[#9EACC4]">
              <strong className="text-slate-900 dark:text-[#F4F7FF]">
                {isAr ? 'محدودية بيئة التشغيل:' : 'Environment Limitation:'}
              </strong>{' '}
              {traceResult.reason}
            </div>
          )}

          {traceResult && traceResult.supported && traceResult.hops.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#263650]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-[#0E1628] text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-start">{isAr ? 'القفزة' : 'Hop'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'عنوان IP' : 'IP Address'}</th>
                    <th className="px-4 py-2 text-start">{t.common.status}</th>
                    <th className="px-4 py-2 text-end">{isAr ? 'متوسط الاستجابة' : 'Avg RTT'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#263650]/70">
                  {traceResult.hops.map((hop) => (
                    <tr key={hop.hop}>
                      <td className="px-4 py-2 font-mono-tabular">{hop.hop}</td>
                      <td className="px-4 py-2 font-mono-tabular">{hop.ip || '* * *'}</td>
                      <td className="px-4 py-2">
                        {hop.timedOut ? (isAr ? 'انتهت المهلة' : 'Timeout') : isAr ? 'استجاب' : 'Responded'}
                      </td>
                      <td className="px-4 py-2 text-end font-mono-tabular">
                        {hop.rttMs !== null ? `${hop.rttMs} ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ROUTER INFORMATION */}
      {activeTab === 'router' && (
        <section className="nv-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Router className="h-5 w-5 text-[#08C8F0]" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-[#F4F7FF]">
              {t.diagnosticsPage.routerTitle}
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-[#9EACC4] leading-relaxed">
            {t.diagnosticsPage.routerBrowserLimit}
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-[#F4F7FF] mb-2.5">
              {t.diagnosticsPage.routerGuidanceTitle}
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-[#9EACC4] list-disc ps-5">
              {t.diagnosticsPage.routerSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
};
