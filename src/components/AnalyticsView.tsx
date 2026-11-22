import React, { useMemo, useState } from 'react';
import { Award, BarChart3, Download, GitCompare, Printer } from 'lucide-react';
import type { Language, QualityAssessment, SpeedTestResult } from '../types/network';
import { getTranslations } from '../i18n/translations';
import {
  computeAnalyticsSummary,
  groupRecordsByConnectionType,
  groupRecordsByPeriod,
} from '../services/analyticsService';
import { exportHistoryAsCsv, printNetworkReport } from '../services/exportService';
import { EmptyState } from './FeedbackUI';

interface AnalyticsViewProps {
  language: Language;
  history: SpeedTestResult[];
  quality?: QualityAssessment;
  initialCompareIds?: [string, string] | null;
  onStartTest: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  language,
  history,
  quality,
  initialCompareIds,
  onStartTest,
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const completed = useMemo(
    () => history.filter((r) => r.status === 'completed'),
    [history],
  );

  const [testAId, setTestAId] = useState<string>(
    initialCompareIds?.[0] || completed[1]?.id || completed[0]?.id || '',
  );
  const [testBId, setTestBId] = useState<string>(
    initialCompareIds?.[1] || completed[0]?.id || '',
  );

  const summary = useMemo(() => computeAnalyticsSummary(completed), [completed]);
  const buckets = useMemo(() => groupRecordsByPeriod(completed, period), [completed, period]);
  const connectionGroups = useMemo(() => groupRecordsByConnectionType(completed), [completed]);

  const testA = completed.find((r) => r.id === testAId) ?? completed[1] ?? null;
  const testB = completed.find((r) => r.id === testBId) ?? completed[0] ?? null;

  if (!summary || completed.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold text-[#F4F7FF]">{t.analyticsPage.title}</h2>
          <p className="text-sm text-[#9EACC4] mt-0.5">{t.analyticsPage.subtitle}</p>
        </div>
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title={t.historyPage.emptyTitle}
          description={t.analyticsPage.needMoreData}
          actionLabel={t.historyPage.runFirstTest}
          onAction={onStartTest}
        />
      </div>
    );
  }

  const maxBucketSpeed = Math.max(
    10,
    ...buckets.map((b) => Math.max(b.avgDownload, b.avgUpload)),
  );

  const formatDelta = (val: number, unit: string, lowerIsBetter = false) => {
    const sign = val > 0 ? '+' : '';
    const favorable = lowerIsBetter ? val < 0 : val > 0;
    const color =
      val === 0
        ? 'text-[#9aa0d6]'
        : favorable
          ? 'text-[#22C58B]'
          : 'text-[#F06478]';
    return (
      <span className={`font-mono-tabular font-bold ${color}`}>
        {sign}
        {val.toFixed(2)} {unit}
      </span>
    );
  };

  const categoryLabels: Record<string, string> = {
    browsing: t.categories.browsing,
    gaming: t.categories.gaming,
    videocalls: t.categories.videocalls,
    hdStreaming: t.categories.hdStreaming,
    uhdStreaming: t.categories.uhdStreaming,
    largeDownloads: t.categories.largeDownloads,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#F4F7FF]">{t.analyticsPage.title}</h2>
          <p className="text-sm text-[#9EACC4] mt-0.5">{t.analyticsPage.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => exportHistoryAsCsv(completed)}
            className="flex items-center gap-1.5 rounded-xl border border-[#263650] bg-[#121D32] px-3 py-2 text-xs font-medium text-[#F4F7FF] hover:border-[#08C8F0]"
          >
            <Download className="h-3.5 w-3.5 text-[#08C8F0]" />
            <span>{t.historyPage.exportCsv}</span>
          </button>
          <button
            type="button"
            onClick={printNetworkReport}
            className="flex items-center gap-1.5 rounded-xl border border-[#263650] bg-[#121D32] px-3 py-2 text-xs font-medium text-[#F4F7FF] hover:border-[#08C8F0]"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{t.historyPage.printReport}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: t.analyticsPage.avgDownload, val: `${summary.avgDownloadMbps.toFixed(1)} Mbps`, color: 'text-[#08C8F0]' },
          { label: t.analyticsPage.avgUpload, val: `${summary.avgUploadMbps.toFixed(1)} Mbps`, color: 'text-[#A855F7]' },
          { label: t.analyticsPage.peakDownload, val: `${summary.peakDownloadMbps.toFixed(1)} Mbps`, color: 'text-[#F4F7FF]' },
          { label: t.analyticsPage.peakUpload, val: `${summary.peakUploadMbps.toFixed(1)} Mbps`, color: 'text-[#F4F7FF]' },
          { label: t.analyticsPage.avgLatency, val: `${summary.avgPingMs.toFixed(1)} ms`, color: 'text-[#F4F7FF]' },
          { label: t.analyticsPage.stabilityScore, val: `${summary.latencyConsistencyPercent}%`, color: 'text-[#22C58B]' },
        ].map((kpi) => (
          <div key={kpi.label} className="nv-card p-4">
            <div className="text-[11px] text-[#9EACC4]">{kpi.label}</div>
            <div className={`mt-1 text-lg font-bold font-mono-tabular ${kpi.color}`}>{kpi.val}</div>
          </div>
        ))}
      </div>

      {/* NOVYRA Network Score 6-Workload Assessment */}
      {quality && quality.overallRating !== 'insufficient' && (
        <section className="nv-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#18c8ff]" />
              <h3 className="font-display text-sm font-bold text-[#F4F7FF]">
                {isAr ? 'تقييم جودة الشبكة الشامل (NOVYRA Network Score)' : 'NOVYRA Network Score Breakdown'}
              </h3>
            </div>
            <div className="flex items-center gap-2 font-mono-tabular">
              <span className="rounded-lg bg-[#22e06b]/15 border border-[#22e06b]/40 px-2.5 py-0.5 text-xs font-bold text-[#22e06b]">
                {t.ratings[quality.overallRating]} · {quality.overallScore}/100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {quality.categories.map((cat) => {
              const barColor =
                cat.score >= 85
                  ? 'bg-[#22e06b]'
                  : cat.score >= 65
                    ? 'bg-[#18c8ff]'
                    : cat.score >= 45
                      ? 'bg-[#f5b942]'
                      : 'bg-[#f06478]';
              return (
                <div key={cat.id} className="nv-inner p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#eef0ff]">{categoryLabels[cat.id] || cat.id}</span>
                    <span className="font-mono-tabular font-bold text-[#18c8ff]">
                      {cat.score}/100 ({t.ratings[cat.rating]})
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1b2059] overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${cat.score}%` }} />
                  </div>
                  <p className="text-[11px] text-[#9aa0d6] leading-relaxed">
                    {(isAr ? cat.reasonsAr : cat.reasons)[0]}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Period Trend Bar Visualization */}
      <section className="nv-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold text-[#F4F7FF]">{t.analyticsPage.speedTrends}</h3>
          <div className="flex items-center gap-1 rounded-xl bg-[#0E1628] p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  period === p ? 'bg-[#192640] text-[#F4F7FF]' : 'text-[#9EACC4]'
                }`}
              >
                {p === 'daily'
                  ? t.analyticsPage.periodDaily
                  : p === 'weekly'
                    ? t.analyticsPage.periodWeekly
                    : t.analyticsPage.periodMonthly}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {buckets.slice(-10).map((b) => (
            <div key={b.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-[#F4F7FF]">
                  {b.label} ({b.count})
                </span>
                <span className="text-[#9EACC4]">
                  ↓ {b.avgDownload} · ↑ {b.avgUpload} Mbps · {b.avgPing} ms
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <div className="h-2 rounded-full bg-[#0E1628] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#08C8F0]"
                    style={{ width: `${(b.avgDownload / maxBucketSpeed) * 100}%` }}
                  />
                </div>
                <div className="h-2 rounded-full bg-[#0E1628] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#A855F7]"
                    style={{ width: `${(b.avgUpload / maxBucketSpeed) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Side-by-Side Test Comparison + Connection Type Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 nv-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-[#08C8F0]" />
            <h3 className="font-display text-sm font-bold text-[#F4F7FF]">{t.analyticsPage.compareTests}</h3>
          </div>

          {completed.length < 2 ? (
            <p className="text-xs text-[#9EACC4]">{t.analyticsPage.needMoreData}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#9EACC4] mb-1">{t.analyticsPage.selectTestA}</label>
                  <select
                    value={testA?.id || ''}
                    onChange={(e) => setTestAId(e.target.value)}
                    className="w-full rounded-xl border border-[#263650] bg-[#0E1628] px-3 py-2 text-[#F4F7FF]"
                  >
                    {completed.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.timestamp).toLocaleString()} — {r.downloadMbps} Mbps
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#9EACC4] mb-1">{t.analyticsPage.selectTestB}</label>
                  <select
                    value={testB?.id || ''}
                    onChange={(e) => setTestBId(e.target.value)}
                    className="w-full rounded-xl border border-[#263650] bg-[#0E1628] px-3 py-2 text-[#F4F7FF]"
                  >
                    {completed.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.timestamp).toLocaleString()} — {r.downloadMbps} Mbps
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {testA && testB && (
                <div className="overflow-x-auto rounded-xl border border-[#263650]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#0E1628] text-[#9EACC4]">
                      <tr>
                        <th className="px-3 py-2 text-start">{isAr ? 'المؤشر' : 'Metric'}</th>
                        <th className="px-3 py-2 text-end">{isAr ? 'اختبار أ' : 'Test A'}</th>
                        <th className="px-3 py-2 text-end">{isAr ? 'اختبار ب' : 'Test B'}</th>
                        <th className="px-3 py-2 text-end">{t.analyticsPage.delta}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#263650]/70 font-mono-tabular text-[#eef0ff]">
                      <tr>
                        <td className="px-3 py-2.5 font-sans">{t.dashboard.downloadSpeed}</td>
                        <td className="px-3 py-2.5 text-end">{testA.downloadMbps.toFixed(2)} Mbps</td>
                        <td className="px-3 py-2.5 text-end">{testB.downloadMbps.toFixed(2)} Mbps</td>
                        <td className="px-3 py-2.5 text-end">
                          {formatDelta(testB.downloadMbps - testA.downloadMbps, 'Mbps')}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-sans">{t.dashboard.uploadSpeed}</td>
                        <td className="px-3 py-2.5 text-end">{testA.uploadMbps.toFixed(2)} Mbps</td>
                        <td className="px-3 py-2.5 text-end">{testB.uploadMbps.toFixed(2)} Mbps</td>
                        <td className="px-3 py-2.5 text-end">
                          {formatDelta(testB.uploadMbps - testA.uploadMbps, 'Mbps')}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-sans">{isAr ? 'زمن الاستجابة (Ping)' : 'Ping'}</td>
                        <td className="px-3 py-2.5 text-end">{testA.pingMs.toFixed(1)} ms</td>
                        <td className="px-3 py-2.5 text-end">{testB.pingMs.toFixed(1)} ms</td>
                        <td className="px-3 py-2.5 text-end">
                          {formatDelta(testB.pingMs - testA.pingMs, 'ms', true)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-sans">{isAr ? 'التذبذب (Jitter)' : 'Jitter'}</td>
                        <td className="px-3 py-2.5 text-end">{testA.jitterMs.toFixed(1)} ms</td>
                        <td className="px-3 py-2.5 text-end">{testB.jitterMs.toFixed(1)} ms</td>
                        <td className="px-3 py-2.5 text-end">
                          {formatDelta(testB.jitterMs - testA.jitterMs, 'ms', true)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* Connection Type Breakdown */}
        <section className="xl:col-span-5 nv-card p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#F4F7FF]">
            {t.analyticsPage.connectionBreakdown}
          </h3>
          <div className="space-y-3">
            {connectionGroups.map((g) => (
              <div
                key={g.connectionType}
                className="rounded-xl border border-[#263650] bg-[#0E1628] p-3.5 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-[#F4F7FF]">
                  <span className="uppercase">{g.connectionType}</span>
                  <span className="font-mono-tabular text-[#9EACC4]">
                    {isAr ? `${g.count} اختبار` : `${g.count} tests`}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono-tabular text-[#9EACC4]">
                  <span>↓ {g.avgDownload} Mbps</span>
                  <span>↑ {g.avgUpload} Mbps</span>
                  <span>{g.avgPing} ms</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
