import React, { useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Gauge,
  Globe,
  History,
  Play,
  RefreshCw,
  Router,
  Server,
  ShieldCheck,
  Square,
  Waypoints,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import type {
  ConnectionInfo,
  DiagnosticTab,
  Language,
  LiveSample,
  NavSection,
  QualityAssessment,
  ServerNode,
  SpeedTestProgress,
  SpeedTestResult,
} from '../types/network';
import { getTranslations } from '../i18n/translations';
import { SpeedGauge } from './SpeedGauge';
import { MiniSparkline } from './MiniSparkline';
import { TrafficChart } from './TrafficChart';
import { NovyraBot } from './NovyraBot';

interface DashboardProps {
  language: Language;
  servers: ServerNode[];
  selectedServerId: string;
  onSelectServer: (id: string) => void;
  progress: SpeedTestProgress;
  isTesting: boolean;
  onStartTest: () => void;
  onStopTest: () => void;
  latestTest: SpeedTestResult | null;
  history: SpeedTestResult[];
  connectionInfo: ConnectionInfo;
  onRefreshConnectionInfo: () => void;
  quality: QualityAssessment;
  liveSamples: LiveSample[];
  aiConfigured: boolean;
  aiSummary: string | null;
  onNavigate: (section: NavSection, diagTab?: DiagnosticTab) => void;
  animationsEnabled: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  language,
  servers,
  selectedServerId,
  onSelectServer,
  progress,
  isTesting,
  onStartTest,
  onStopTest,
  latestTest,
  history,
  connectionInfo,
  onRefreshConnectionInfo,
  quality,
  liveSamples,
  aiConfigured,
  aiSummary,
  onNavigate,
  animationsEnabled,
}) => {
  const t = getTranslations(language);
  const [monitorRange, setMonitorRange] = useState<1 | 5 | 15>(5);
  const [copiedKey, setCopiedKey] = useState<'public' | 'local' | null>(null);

  const activeDownload =
    isTesting || progress.phase === 'complete'
      ? progress.downloadMbps
      : latestTest?.downloadMbps ?? null;
  const activeUpload =
    isTesting || progress.phase === 'complete'
      ? progress.uploadMbps
      : latestTest?.uploadMbps ?? null;
  const activePing =
    isTesting || progress.phase === 'complete'
      ? progress.idlePingMs
      : latestTest?.pingMs ?? null;
  const activeJitter =
    isTesting || progress.phase === 'complete'
      ? progress.jitterMs
      : latestTest?.jitterMs ?? null;
  const activeLoss =
    isTesting || progress.phase === 'complete'
      ? progress.probeLossPercent
      : latestTest?.probeLossPercent ?? null;

  const gaugeSpeed = isTesting
    ? progress.currentSpeedMbps
    : progress.phase === 'complete'
      ? progress.downloadMbps ?? 0
      : latestTest?.downloadMbps ?? 0;

  const downloadSparkSamples = isTesting
    ? progress.downloadSamples
    : progress.downloadSamples.length >= 2
      ? progress.downloadSamples
      : (latestTest?.downloadSamples ?? []);

  const uploadSparkSamples = isTesting
    ? progress.uploadSamples
    : progress.uploadSamples.length >= 2
      ? progress.uploadSamples
      : (latestTest?.uploadSamples ?? []);

  const selectedServer = servers.find((s) => s.id === selectedServerId) ?? servers[0];
  const serverSignalLevel = (() => {
    if (!selectedServer) return 0;
    if (selectedServer.status === 'unreachable') return 0;
    if (selectedServer.latencyMs === null) return 2;
    if (selectedServer.latencyMs <= 50) return 4;
    if (selectedServer.latencyMs <= 120) return 3;
    if (selectedServer.latencyMs <= 250) return 2;
    return 1;
  })();

  const signalBarColor =
    serverSignalLevel >= 3
      ? 'bg-[#0a9a45] dark:bg-[#22e06b]'
      : serverSignalLevel >= 1
        ? 'bg-[#d97706] dark:bg-[#f5b942]'
        : 'bg-[#dc2626] dark:bg-[#f06478]';

  const phaseLabel = (() => {
    switch (progress.phase) {
      case 'ping':
        return t.dashboard.testingPhasePing;
      case 'download':
        return t.dashboard.testingPhaseDownload;
      case 'upload':
        return t.dashboard.testingPhaseUpload;
      case 'complete':
        return t.dashboard.testComplete;
      case 'cancelled':
        return t.dashboard.testCancelled;
      case 'error':
        return progress.errorMessage || t.dashboard.testError;
      default:
        return latestTest
          ? `${t.dashboard.lastTested}: ${new Date(latestTest.timestamp).toLocaleString()}`
          : t.dashboard.readyToTest;
    }
  })();

  const displayPublicIp =
    connectionInfo.publicIpv4 || connectionInfo.publicIpv6 || connectionInfo.serverObservedIp;

  const handleCopyIp = async (value: string | null, which: 'public' | 'local') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(which);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  // Real quality headline for AI card
  const aiHeadline = (() => {
    if (!aiConfigured) return t.dashboard.aiNotConfigured;
    if (latestTest) {
      return `${t.ratings[quality.overallRating]} (${quality.overallScore}%)`;
    }
    return t.dashboard.aiReady;
  })();

  const aiBody = (() => {
    if (!aiConfigured) return t.dashboard.aiNotConfiguredDesc;
    if (aiSummary) return aiSummary;
    if (latestTest) {
      return language === 'ar'
        ? `أحدث قياس: تحميل ${latestTest.downloadMbps.toFixed(1)} Mbps، رفع ${latestTest.uploadMbps.toFixed(1)} Mbps، واستجابة ${latestTest.pingMs.toFixed(0)} ms.`
        : `Latest benchmark: ${latestTest.downloadMbps.toFixed(1)} Mbps down, ${latestTest.uploadMbps.toFixed(1)} Mbps up, ${latestTest.pingMs.toFixed(0)} ms RTT.`;
    }
    return t.dashboard.aiPromptRunTest;
  })();

  const quickTools: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    iconColor: string;
  }> = [
    {
      id: 'ping',
      label: t.tools.pingTool,
      icon: Activity,
      action: () => onNavigate('diagnostics', 'ping'),
      iconColor: 'text-[#0891b2] dark:text-[#18c8ff]',
    },
    {
      id: 'traceroute',
      label: t.tools.traceroute,
      icon: Waypoints,
      action: () => onNavigate('diagnostics', 'traceroute'),
      iconColor: 'text-[#ff8a3d]',
    },
    {
      id: 'ports',
      label: t.tools.portChecker,
      icon: ShieldCheck,
      action: () => onNavigate('diagnostics', 'ports'),
      iconColor: 'text-[#0a9a45] dark:text-[#22e06b]',
    },
    {
      id: 'dns',
      label: t.tools.dnsChecker,
      icon: Server,
      action: () => onNavigate('diagnostics', 'dns'),
      iconColor: 'text-[#0891b2] dark:text-[#18c8ff]',
    },
    {
      id: 'info',
      label: t.tools.networkInfo,
      icon: Globe,
      action: () => onNavigate('info'),
      iconColor: 'text-[#5b3df5] dark:text-[#8b7bff]',
    },
    {
      id: 'dnsTools',
      label: t.tools.dnsTools,
      icon: Globe,
      action: () => onNavigate('dns'),
      iconColor: 'text-[#5b3df5] dark:text-[#8b7bff]',
    },
    {
      id: 'router',
      label: t.tools.routerInfo,
      icon: Router,
      action: () => onNavigate('diagnostics', 'router'),
      iconColor: 'text-[#5b3df5] dark:text-[#8b7bff]',
    },
  ];

  const completedHistory = history.filter((h) => h.status === 'completed');

  return (
    <div className="space-y-3.5">
      {/* ROW 1: Speed Test Hero (left/start) + Connection Info & AI Bot (right/end) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-3.5 items-stretch">
        {/* SPEED TEST HERO CARD */}
        <section className="nv-card p-4 sm:p-5 flex flex-col justify-between min-w-0">
          {/* Header + Server Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2.5 text-[#141847] dark:text-[#eef0ff]">
              <Zap className="h-5 w-5 text-[#0891b2] dark:text-[#18c8ff]" />
              <span>{t.dashboard.speedTestTitle}</span>
            </h2>

            <div className="nv-inner flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm max-w-full">
              <span
                className="inline-flex items-end gap-0.5 shrink-0"
                title={
                  selectedServer?.latencyMs !== null && selectedServer?.latencyMs !== undefined
                    ? `${selectedServer.latencyMs} ms`
                    : selectedServer?.status
                }
                aria-hidden="true"
              >
                {[
                  { bar: 1, h: 'h-1.5' },
                  { bar: 2, h: 'h-2.5' },
                  { bar: 3, h: 'h-3.5' },
                  { bar: 4, h: 'h-4' },
                ].map((item) => (
                  <i
                    key={item.bar}
                    className={`w-1 ${item.h} block rounded-xs transition-colors ${
                      item.bar <= serverSignalLevel
                        ? signalBarColor
                        : 'bg-[#cbd5f5] dark:bg-[#2a3174]'
                    }`}
                  />
                ))}
              </span>
              <select
                value={selectedServerId}
                onChange={(e) => onSelectServer(e.target.value)}
                disabled={isTesting}
                aria-label="Select speed test server"
                className="bg-transparent text-xs sm:text-sm font-medium text-[#141847] dark:text-[#eef0ff] focus:outline-none truncate max-w-[210px] sm:max-w-[270px]"
              >
                {servers.map((srv) => (
                  <option key={srv.id} value={srv.id} className="bg-white dark:bg-[#0d1033]">
                    {language === 'ar' ? srv.nameAr : srv.name}
                    {srv.latencyMs !== null ? ` (${srv.latencyMs} ms)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3-Column Benchmark Stage */}
          <div className="my-3 grid grid-cols-2 md:grid-cols-[1fr_1.5fr_1fr] gap-3 items-center">
            {/* Download Mini Card */}
            <div className="order-2 md:order-1 nv-inner p-3.5 sm:p-4 flex flex-col items-center text-center min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#18c8ff]/15 text-[#0891b2] dark:text-[#18c8ff] mb-1.5">
                <ArrowDown className="h-5 w-5" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#4c538c] dark:text-[#cfd3ff]">
                {t.dashboard.downloadSpeed}
              </p>
              <div className="mt-1 text-2xl sm:text-3xl lg:text-[36px] font-bold font-mono-tabular text-[#141847] dark:text-white leading-tight">
                {activeDownload !== null ? activeDownload.toFixed(2) : '—'}
              </div>
              <small className="text-xs font-medium text-[#5a6099] dark:text-[#dfe2ff]">
                {t.common.mbps}
              </small>
              <div className="mt-2.5 w-full">
                <MiniSparkline
                  samples={downloadSparkSamples}
                  strokeColor="#18c8ff"
                  fillId="nv-dl-spark"
                />
              </div>
            </div>

            {/* Central Neon Speedometer + CTA */}
            <div className="col-span-2 md:col-span-1 order-1 md:order-2 flex flex-col items-center justify-center min-w-0">
              <SpeedGauge
                speedMbps={gaugeSpeed}
                phase={progress.phase}
                phaseLabel={phaseLabel}
                unitLabel={t.common.mbps}
                animationsEnabled={animationsEnabled}
              />

              {isTesting && (
                <div className="mt-1.5 w-full max-w-[240px] h-1.5 rounded-full bg-indigo-200 dark:bg-[#1b2059] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#18c8ff] to-[#a855f7] transition-all duration-150"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={isTesting ? onStopTest : onStartTest}
                disabled={!connectionInfo.online && !isTesting}
                className={`${isTesting ? 'mt-2.5' : '-mt-1'} flex items-center justify-center gap-2.5 w-full max-w-[220px] rounded-xl px-5 py-2.5 sm:py-3 text-sm sm:text-base font-bold transition-all whitespace-nowrap ${
                  isTesting
                    ? 'bg-[#dc2626] hover:bg-[#b91c1c] text-white shadow-lg shadow-[#dc2626]/25'
                    : 'nv-btn-primary disabled:opacity-40'
                }`}
              >
                {isTesting ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isTesting ? t.dashboard.stopTest : t.dashboard.startTest}</span>
              </button>
            </div>

            {/* Upload Mini Card */}
            <div className="order-3 nv-inner p-3.5 sm:p-4 flex flex-col items-center text-center min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#7c3aed] dark:text-[#a855f7] mb-1.5">
                <ArrowUp className="h-5 w-5" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#4c538c] dark:text-[#cfd3ff]">
                {t.dashboard.uploadSpeed}
              </p>
              <div className="mt-1 text-2xl sm:text-3xl lg:text-[36px] font-bold font-mono-tabular text-[#141847] dark:text-white leading-tight">
                {activeUpload !== null ? activeUpload.toFixed(2) : '—'}
              </div>
              <small className="text-xs font-medium text-[#5a6099] dark:text-[#dfe2ff]">
                {t.common.mbps}
              </small>
              <div className="mt-2.5 w-full">
                <MiniSparkline
                  samples={uploadSparkSamples}
                  strokeColor="#a855f7"
                  fillId="nv-ul-spark"
                />
              </div>
            </div>
          </div>

          {/* Bottom Real Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 border-t border-[#d3d8f5] dark:border-[#20246a]">
            <div className="flex items-center gap-3">
              <Gauge className="h-6 w-6 text-[#0891b2] dark:text-[#18c8ff] shrink-0" />
              <div>
                <span className="block text-xs text-[#4c538c] dark:text-[#dfe2ff]">
                  {t.dashboard.pingLabel}
                </span>
                <b className="text-base sm:text-lg font-semibold font-mono-tabular text-[#141847] dark:text-white">
                  {activePing !== null ? `${activePing.toFixed(1)} ${t.common.ms}` : '—'}
                </b>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-[#7c3aed] dark:text-[#a855f7] shrink-0" />
              <div>
                <span className="block text-xs text-[#4c538c] dark:text-[#dfe2ff]">
                  {t.dashboard.jitterLabel}
                </span>
                <b className="text-base sm:text-lg font-semibold font-mono-tabular text-[#141847] dark:text-white">
                  {activeJitter !== null ? `${activeJitter.toFixed(1)} ${t.common.ms}` : '—'}
                </b>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-[#0a9a45] dark:text-[#22e06b] shrink-0" />
              <div>
                <span className="block text-xs text-[#4c538c] dark:text-[#dfe2ff]">
                  {t.dashboard.packetLossLabel}
                </span>
                <b className="text-base sm:text-lg font-semibold font-mono-tabular text-[#141847] dark:text-white">
                  {activeLoss !== null ? `${activeLoss}%` : t.dashboard.untested}
                </b>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-[#f5b942] shrink-0" />
              <div>
                <span className="block text-xs text-[#4c538c] dark:text-[#dfe2ff]">
                  {t.dashboard.downloadLatency}
                </span>
                <b className="text-base sm:text-lg font-semibold font-mono-tabular text-[#141847] dark:text-white">
                  {progress.downloadLatencyMs !== null
                    ? `${progress.downloadLatencyMs.toFixed(0)} ${t.common.ms}`
                    : latestTest?.downloadLatencyMs != null
                      ? `${latestTest.downloadLatencyMs.toFixed(0)} ${t.common.ms}`
                      : '—'}
                </b>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Connection Info + AI Robot Card */}
        <div className="flex flex-col gap-3.5 min-w-0">
          {/* Connection Info */}
          <section className="nv-card p-4 sm:p-5 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold flex items-center gap-2 text-[#141847] dark:text-[#eef0ff]">
                <Wifi className="h-4 w-4 text-[#0891b2] dark:text-[#18c8ff]" />
                <span>{t.dashboard.connectionInfo}</span>
              </h3>
              <button
                type="button"
                onClick={onRefreshConnectionInfo}
                title={t.dashboard.refreshInfo}
                className={`flex items-center gap-1.5 text-xs font-semibold ${
                  connectionInfo.online
                    ? 'text-[#0a9a45] dark:text-[#22e06b]'
                    : 'text-[#dc2626] dark:text-[#f06478]'
                }`}
              >
                <RefreshCw
                  className={`h-3 w-3 ${connectionInfo.isLoadingPublicIp ? 'animate-spin' : ''}`}
                />
                <span>{connectionInfo.online ? t.topbar.online : t.topbar.offline}</span>
              </button>
            </div>

            {/* Wi-Fi / Interface Banner */}
            <div className="nv-inner flex items-center gap-3.5 p-3 my-3">
              <Wifi className="h-9 w-9 text-[#0891b2] dark:text-[#18c8ff] shrink-0" />
              <div className="min-w-0">
                <b className="block text-sm sm:text-base text-[#141847] dark:text-[#eef0ff] uppercase truncate">
                  {connectionInfo.connectionType || connectionInfo.effectiveType || t.dashboard.unavailable}
                </b>
                <small className="text-xs text-[#5a6099] dark:text-[#9aa0d6]">
                  {t.dashboard.networkType}
                </small>
              </div>
            </div>

            {/* Key-Value Rows */}
            <div className="divide-y divide-[#d3d8f5] dark:divide-[#1d2160] text-xs sm:text-sm">
              <div className="flex items-center justify-between py-2 gap-2">
                <span className="text-[#4c538c] dark:text-[#cfd3ff]">{t.dashboard.publicIp}</span>
                <span className="flex items-center gap-2 font-mono-tabular font-medium text-[#141847] dark:text-white">
                  {displayPublicIp || t.dashboard.unavailable}
                  {displayPublicIp && (
                    <button
                      type="button"
                      onClick={() => handleCopyIp(displayPublicIp, 'public')}
                      title={t.dashboard.copyIp}
                      className="text-[#4c538c] dark:text-[#cfd3ff] hover:text-[#18c8ff]"
                    >
                      {copiedKey === 'public' ? (
                        <Check className="h-3.5 w-3.5 text-[#22e06b]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 gap-2">
                <span className="text-[#4c538c] dark:text-[#cfd3ff]">{t.dashboard.localIp}</span>
                <span className="flex items-center gap-2 font-mono-tabular font-medium text-[#141847] dark:text-white">
                  {connectionInfo.localIp || t.dashboard.unavailable}
                  {connectionInfo.localIp && (
                    <button
                      type="button"
                      onClick={() => handleCopyIp(connectionInfo.localIp, 'local')}
                      title={t.dashboard.copyIp}
                      className="text-[#4c538c] dark:text-[#cfd3ff] hover:text-[#18c8ff]"
                    >
                      {copiedKey === 'local' ? (
                        <Check className="h-3.5 w-3.5 text-[#22e06b]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 gap-2">
                <span className="text-[#4c538c] dark:text-[#cfd3ff]">{t.dashboard.isp}</span>
                <span className="font-medium text-[#141847] dark:text-white truncate max-w-[170px]">
                  {connectionInfo.isp || t.dashboard.unavailable}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 gap-2">
                <span className="text-[#4c538c] dark:text-[#cfd3ff]">{t.dashboard.dnsLabel}</span>
                <span className="font-mono-tabular font-medium text-[#141847] dark:text-white">
                  {connectionInfo.dnsServers || t.dashboard.unavailable}
                </span>
              </div>
            </div>

            {/* Quality Progress Bar */}
            <div className="flex items-center gap-3 pt-3 mt-1 border-t border-[#d3d8f5] dark:border-[#1d2160] text-xs sm:text-sm">
              <span className="text-[#4c538c] dark:text-[#cfd3ff] whitespace-nowrap">
                {t.dashboard.connectionQuality}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[#d3d8f5] dark:bg-[#222866] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#16c45a] to-[#2be57a] transition-all duration-300"
                  style={{ width: `${quality.overallScore}%` }}
                />
              </div>
              <b className="font-mono-tabular text-[#141847] dark:text-white">
                {quality.overallRating === 'insufficient' ? '—' : `${quality.overallScore}%`}
              </b>
            </div>
          </section>

          {/* NOVYRA AI Robot Assistant Card */}
          <section className="nv-ai-card p-4 sm:p-5 flex items-center gap-3.5">
            <div className="shrink-0 hidden sm:flex items-center justify-center">
              <NovyraBot className="w-20 h-24" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#141847] dark:text-white truncate">
                  {t.dashboard.aiAdvisor}
                </h3>
                <span className="rounded-lg bg-[#4f46e5] px-2.5 py-0.5 text-xs font-bold text-white shrink-0">
                  AI
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm sm:text-base font-bold text-[#141847] dark:text-white">
                <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-[#22e06b] text-[#041] text-xs font-bold shrink-0">
                  ✓
                </span>
                <span className="truncate">{aiHeadline}</span>
              </div>

              <p className="mt-1.5 text-xs sm:text-sm text-[#2d3270] dark:text-[#dfe2ff] leading-relaxed line-clamp-2">
                {aiBody}
              </p>

              <button
                type="button"
                onClick={() => onNavigate('ai')}
                className="mt-3 rounded-full border border-[#7a6bff] bg-white dark:bg-[#2a1d8f]/85 px-4 py-1.5 text-xs font-semibold text-[#3a2fc0] dark:text-white hover:brightness-110 transition-all whitespace-nowrap"
              >
                {t.dashboard.viewDetails}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ROW 2: Live Internet Monitor + Test History */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-3.5">
        <section className="nv-card p-4 sm:p-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold flex items-center gap-2 text-[#141847] dark:text-[#eef0ff]">
                <Activity className="h-4 w-4 text-[#0891b2] dark:text-[#18c8ff]" />
                <span>{t.dashboard.liveMonitoring}</span>
              </h3>
              <p className="text-[11px] text-[#5a6099] dark:text-[#9aa0d6]">
                {t.dashboard.browserProbeNotice}
              </p>
            </div>

            <div className="nv-inner flex items-center gap-1 p-1">
              {([1, 5, 15] as const).map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setMonitorRange(min)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                    monitorRange === min
                      ? 'bg-[#4f46e5] text-white'
                      : 'text-[#4c538c] dark:text-[#cfd3ff] hover:text-[#141847] dark:hover:text-white'
                  }`}
                >
                  {language === 'ar' ? `${min} د` : `${min}m`}
                </button>
              ))}
            </div>
          </div>

          <TrafficChart
            samples={liveSamples}
            rangeMinutes={monitorRange}
            mode="combined"
            emptyLabel={t.monitoringPage.noSamplesYet}
            primaryLabel={t.monitoringPage.latencyChartTitle}
            secondaryLabel={t.monitoringPage.activityChartTitle}
            height={185}
          />
        </section>

        <section className="nv-card p-4 sm:p-5 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#d3d8f5] dark:border-[#262a6b]">
            <h3 className="font-display text-base sm:text-lg font-bold flex items-center gap-2 text-[#141847] dark:text-[#eef0ff]">
              <History className="h-4 w-4 text-[#7c3aed] dark:text-[#a855f7]" />
              <span>{t.dashboard.recentHistory}</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-[#0891b2] dark:text-[#18c8ff] hover:underline"
            >
              {t.dashboard.viewAll}
            </button>
          </div>

          <div className="mt-2 flex-1 divide-y divide-[#d3d8f5] dark:divide-[#1d2160]">
            {history.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5a6099] dark:text-[#9aa0d6]">
                {t.historyPage.emptyDesc}
              </div>
            ) : (
              history.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular"
                >
                  <span className="text-[#0891b2] dark:text-[#18c8ff] font-semibold">
                    ⤓ {item.downloadMbps.toFixed(2)} Mbps
                  </span>
                  <span className="text-[#7c3aed] dark:text-[#a855f7] font-semibold">
                    ⤒ {item.uploadMbps.toFixed(2)} Mbps
                  </span>
                  <span className="text-[#4c538c] dark:text-[#cfd3ff]">
                    {item.pingMs.toFixed(0)} ms
                  </span>
                  <span className="text-[#5a6099] dark:text-[#9aa0d6] font-sans text-[11px]">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ROW 3: Network Status + 7 Quick Network Tools */}
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-3.5">
        <section className="nv-card p-5 flex flex-col items-center justify-center text-center gap-2 min-w-0">
          <div className="flex items-center gap-2 text-base font-bold text-[#141847] dark:text-[#eef0ff]">
            {connectionInfo.online ? (
              <CheckCircle2 className="h-6 w-6 text-[#0a9a45] dark:text-[#22e06b]" />
            ) : (
              <WifiOff className="h-6 w-6 text-[#dc2626] dark:text-[#f06478]" />
            )}
            <span>{t.dashboard.networkStatus}</span>
          </div>
          <div
            className={`text-base font-bold ${
              connectionInfo.online
                ? 'text-[#0a9a45] dark:text-[#22e06b]'
                : 'text-[#dc2626] dark:text-[#f06478]'
            }`}
          >
            {connectionInfo.online ? t.dashboard.stable : t.dashboard.disconnected}
          </div>
          <small className="text-xs text-[#5a6099] dark:text-[#9aa0d6]">
            {completedHistory.length > 0
              ? `${completedHistory.length} ${t.dashboard.totalTests}`
              : t.dashboard.noIssues}
          </small>
        </section>

        <section className="nv-card p-4 sm:p-5 min-w-0">
          <h3 className="font-display text-base font-bold text-[#141847] dark:text-[#eef0ff] mb-3">
            {t.dashboard.quickTools}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {quickTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={tool.action}
                  className="nv-inner group flex flex-col items-center justify-center gap-2 px-2.5 py-3.5 text-center hover:border-[#18c8ff] hover:shadow-[0_0_16px_rgba(24,200,255,0.22)] transition-all"
                >
                  <Icon
                    className={`h-7 w-7 ${tool.iconColor} group-hover:scale-105 transition-transform`}
                  />
                  <span className="text-xs font-medium text-[#141847] dark:text-[#eef0ff] leading-tight">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
