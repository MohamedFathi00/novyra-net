import React from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Gauge,
  Info,
  Play,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Square,
} from 'lucide-react';
import type {
  ConnectionInfo,
  Language,
  QualityAssessment,
  ServerNode,
  SpeedTestProgress,
  SpeedTestResult,
} from '../types/network';
import { getTranslations } from '../i18n/translations';
import { SpeedGauge } from './SpeedGauge';
import { MiniSparkline } from './MiniSparkline';

interface SpeedTestConsoleProps {
  language: Language;
  servers: ServerNode[];
  selectedServerId: string;
  onSelectServer: (id: string) => void;
  probingServers: boolean;
  onProbeServers: () => void;
  progress: SpeedTestProgress;
  isTesting: boolean;
  onStartTest: () => void;
  onStopTest: () => void;
  latestTest: SpeedTestResult | null;
  isSavedInHistory: boolean;
  onSaveToHistory: (result: SpeedTestResult) => void;
  connectionInfo: ConnectionInfo;
  quality: QualityAssessment;
  animationsEnabled: boolean;
}

export const SpeedTestConsole: React.FC<SpeedTestConsoleProps> = ({
  language,
  servers,
  selectedServerId,
  onSelectServer,
  probingServers,
  onProbeServers,
  progress,
  isTesting,
  onStartTest,
  onStopTest,
  latestTest,
  isSavedInHistory,
  onSaveToHistory,
  connectionInfo,
  quality,
  animationsEnabled,
}) => {
  const t = getTranslations(language);

  const gaugeSpeed = isTesting
    ? progress.currentSpeedMbps
    : progress.phase === 'complete'
      ? progress.downloadMbps ?? 0
      : latestTest?.downloadMbps ?? 0;

  const dlValue =
    isTesting || progress.phase === 'complete'
      ? progress.downloadMbps
      : latestTest?.downloadMbps ?? null;
  const ulValue =
    isTesting || progress.phase === 'complete'
      ? progress.uploadMbps
      : latestTest?.uploadMbps ?? null;
  const pingValue =
    isTesting || progress.phase === 'complete'
      ? progress.idlePingMs
      : latestTest?.pingMs ?? null;
  const jitterValue =
    isTesting || progress.phase === 'complete'
      ? progress.jitterMs
      : latestTest?.jitterMs ?? null;
  const lossValue =
    isTesting || progress.phase === 'complete'
      ? progress.probeLossPercent
      : latestTest?.probeLossPercent ?? null;

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
        return t.dashboard.readyToTest;
    }
  })();

  const ratingBadgeColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'text-[#16A36D] dark:text-[#22C58B]';
      case 'good':
        return 'text-[#069FC7] dark:text-[#08C8F0]';
      case 'fair':
        return 'text-[#D99B1E] dark:text-[#F5B942]';
      case 'poor':
        return 'text-[#DF475E] dark:text-[#F06478]';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F7FF]">
            {t.speedtestPage.title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#9EACC4] mt-0.5">
            {t.speedtestPage.subtitle}
          </p>
        </div>
        {latestTest && progress.phase === 'complete' && (
          <button
            type="button"
            disabled={isSavedInHistory}
            onClick={() => onSaveToHistory(latestTest)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#263650] bg-white dark:bg-[#121D32] px-4 py-2 text-xs font-semibold text-slate-800 dark:text-[#F4F7FF] hover:bg-slate-50 dark:hover:bg-[#192640] disabled:opacity-60"
          >
            {isSavedInHistory ? <CheckCircle2 className="h-4 w-4 text-[#22C58B]" /> : <Save className="h-4 w-4 text-[#08C8F0]" />}
            <span>{isSavedInHistory ? t.speedtestPage.savedToHistory : t.speedtestPage.saveToHistory}</span>
          </button>
        )}
      </div>

      {/* Main Benchmark Panel */}
      <section className="nv-card p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Download & Upload Summary Column */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-[#9EACC4]">
                  {t.dashboard.downloadSpeed}
                </span>
                <ArrowDown className="h-4 w-4 text-[#08C8F0]" />
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900 dark:text-[#F4F7FF] font-mono-tabular">
                {dlValue !== null ? dlValue.toFixed(2) : '—'}{' '}
                <span className="text-xs font-medium text-slate-500">{t.common.mbps}</span>
              </div>
              <div className="mt-2">
                <MiniSparkline samples={progress.downloadSamples} strokeColor="#08C8F0" fillId="sp-dl" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-[#9EACC4]">
                  {t.dashboard.uploadSpeed}
                </span>
                <ArrowUp className="h-4 w-4 text-[#A855F7]" />
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900 dark:text-[#F4F7FF] font-mono-tabular">
                {ulValue !== null ? ulValue.toFixed(2) : '—'}{' '}
                <span className="text-xs font-medium text-slate-500">{t.common.mbps}</span>
              </div>
              <div className="mt-2">
                <MiniSparkline samples={progress.uploadSamples} strokeColor="#A855F7" fillId="sp-ul" />
              </div>
            </div>
          </div>

          {/* Center Speedometer */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <SpeedGauge
              speedMbps={gaugeSpeed}
              phase={progress.phase}
              phaseLabel={phaseLabel}
              unitLabel={t.common.mbps}
              animationsEnabled={animationsEnabled}
            />
            {isTesting && (
              <div className="mt-3 w-full max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-[#192640] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#08C8F0] to-[#6555FF] transition-all duration-150"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={isTesting ? onStopTest : onStartTest}
              disabled={!connectionInfo.online && !isTesting}
              className={`mt-4 flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white transition-all ${
                isTesting
                  ? 'bg-[#DF475E] hover:bg-[#c8394f]'
                  : 'bg-gradient-to-r from-[#08C8F0] to-[#6555FF] hover:opacity-95 shadow-lg shadow-[#6555FF]/30 disabled:opacity-40'
              }`}
            >
              {isTesting ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isTesting ? t.dashboard.stopTest : t.dashboard.startTest}</span>
            </button>
          </div>

          {/* Detailed Latency Telemetry Column */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-3.5">
              <div className="text-[11px] text-slate-500 dark:text-[#9EACC4]">{t.dashboard.idleLatency}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F7FF] font-mono-tabular">
                {pingValue !== null ? `${pingValue.toFixed(1)} ms` : '—'}
              </div>
              <div className="mt-1 text-[10px] text-slate-400 font-mono-tabular">
                {progress.minPingMs !== null && progress.maxPingMs !== null
                  ? language === 'ar'
                    ? `الأدنى ${progress.minPingMs} · الأعلى ${progress.maxPingMs}`
                    : `Min ${progress.minPingMs} · Max ${progress.maxPingMs}`
                  : latestTest
                    ? language === 'ar'
                      ? `الأدنى ${latestTest.minPingMs} · الأعلى ${latestTest.maxPingMs}`
                      : `Min ${latestTest.minPingMs} · Max ${latestTest.maxPingMs}`
                    : 'HTTP/TCP RTT'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-3.5">
              <div className="text-[11px] text-slate-500 dark:text-[#9EACC4]">{t.dashboard.jitterLabel}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F7FF] font-mono-tabular">
                {jitterValue !== null ? `${jitterValue.toFixed(1)} ms` : '—'}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {language === 'ar' ? 'متوسط تغير RTT' : 'Mean |ΔRTT|'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-3.5">
              <div className="text-[11px] text-slate-500 dark:text-[#9EACC4]">{t.dashboard.downloadLatency}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F7FF] font-mono-tabular">
                {(progress.downloadLatencyMs ?? latestTest?.downloadLatencyMs) != null
                  ? `${(progress.downloadLatencyMs ?? latestTest?.downloadLatencyMs)?.toFixed(0)} ms`
                  : '—'}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {language === 'ar' ? 'زمن الاستجابة تحت الحمل' : 'Loaded RTT'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628] p-3.5">
              <div className="text-[11px] text-slate-500 dark:text-[#9EACC4]">{t.dashboard.packetLossLabel}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F7FF] font-mono-tabular">
                {lossValue !== null ? `${lossValue}%` : t.dashboard.untested}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {language === 'ar' ? 'فقدان نبضات HTTP' : 'HTTP Probe Loss'}
              </div>
            </div>
          </div>
        </div>

        {/* Honest Methodology Disclosure */}
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50 dark:bg-[#0E1628]/70 px-4 py-3 text-xs text-slate-600 dark:text-[#9EACC4]">
          <Info className="h-4 w-4 text-[#08C8F0] shrink-0 mt-0.5" />
          <span>{t.speedtestPage.methodDisclosure}</span>
        </div>
      </section>

      {/* Server Matrix + Quality Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Testing Servers */}
        <section className="xl:col-span-5 nv-card p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#263650]">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#08C8F0]" />
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
                {t.speedtestPage.serverMatrix}
              </h3>
            </div>
            <button
              type="button"
              onClick={onProbeServers}
              disabled={probingServers}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#263650] px-2.5 py-1 text-xs font-medium text-[#069FC7] dark:text-[#08C8F0] hover:bg-slate-50 dark:hover:bg-[#192640]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${probingServers ? 'animate-spin' : ''}`} />
              <span>{probingServers ? t.speedtestPage.probing : t.speedtestPage.probeServers}</span>
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {servers.map((srv) => {
              const selected = srv.id === selectedServerId;
              return (
                <button
                  key={srv.id}
                  type="button"
                  disabled={!srv.isPrimaryBenchmark || isTesting}
                  onClick={() => onSelectServer(srv.id)}
                  className={`w-full text-start rounded-xl border p-3 transition-colors ${
                    selected
                      ? 'border-[#08C8F0] bg-[#08C8F0]/10'
                      : 'border-slate-200 dark:border-[#263650]/80 bg-slate-50/70 dark:bg-[#0E1628]/70'
                  } ${!srv.isPrimaryBenchmark ? 'opacity-85 cursor-default' : 'hover:border-[#08C8F0]/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-[#F4F7FF]">
                      {language === 'ar' ? srv.nameAr : srv.name}
                    </span>
                    <span className="font-mono-tabular text-xs font-semibold text-[#069FC7] dark:text-[#08C8F0]">
                      {srv.latencyMs !== null
                        ? `${srv.latencyMs} ms`
                        : srv.status === 'unreachable'
                          ? language === 'ar'
                            ? 'غير متاح'
                            : 'Unreachable'
                          : language === 'ar'
                            ? 'غير مفحوص'
                            : 'Unchecked'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-[#9EACC4]">
                    {language === 'ar' ? srv.locationAr : srv.location} ·{' '}
                    {srv.isPrimaryBenchmark ? t.speedtestPage.primaryNodeNote : t.speedtestPage.edgeNodeNote}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Connection Quality Breakdown */}
        <section className="xl:col-span-7 nv-card p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#263650]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#22C58B]" />
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
                {t.speedtestPage.qualityBreakdown}
              </h3>
            </div>
            <span className={`text-xs font-bold ${ratingBadgeColor(quality.overallRating)}`}>
              {quality.overallRating === 'insufficient'
                ? t.ratings.insufficient
                : `${quality.overallScore}% · ${t.ratings[quality.overallRating]}`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quality.categories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-slate-200 dark:border-[#263650]/80 bg-slate-50/70 dark:bg-[#0E1628]/70 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#F4F7FF]">
                    {t.categories[cat.id]}
                  </span>
                  <span className={`text-xs font-bold font-mono-tabular ${ratingBadgeColor(cat.rating)}`}>
                    {t.ratings[cat.rating]} {cat.score > 0 ? `(${cat.score}%)` : ''}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-[#9EACC4] leading-relaxed">
                  {language === 'ar' ? cat.reasonsAr[0] : cat.reasons[0]}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-slate-500 dark:text-[#9EACC4] flex items-start gap-2">
            <Gauge className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span>{t.speedtestPage.qualityDisclaimer}</span>
          </p>
        </section>
      </div>
    </div>
  );
};
