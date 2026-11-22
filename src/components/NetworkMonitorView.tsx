import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CloudUpload,
  Crown,
  Info,
  Pause,
  Play,
  Trash2,
  WifiOff,
} from 'lucide-react';
import type { Language, LiveSample, MonitoringSnapshotDoc } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import { canUseFeature } from '../services/entitlementService';
import { fetchMonitoringSnapshots, saveMonitoringSnapshot } from '../services/cloudSyncService';
import { TrafficChart } from './TrafficChart';

interface NetworkMonitorViewProps {
  language: Language;
  samples: LiveSample[];
  monitoringActive: boolean;
  onToggleMonitoring: () => void;
  onClearSamples: () => void;
  interruptionsCount: number;
  onUpgrade?: () => void;
  onRequireAuth?: () => void;
  onNotify?: (type: 'success' | 'info' | 'warning' | 'error', title: string, desc?: string) => void;
}

export const NetworkMonitorView: React.FC<NetworkMonitorViewProps> = ({
  language,
  samples,
  monitoringActive,
  onToggleMonitoring,
  onClearSamples,
  interruptionsCount,
  onUpgrade,
  onRequireAuth,
  onNotify,
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';
  const { user, emailVerified, entitlements, featureFlags } = useAuth();
  const cloudAllowed = canUseFeature('cloud_sync', entitlements, featureFlags);

  const [range, setRange] = useState<1 | 5 | 15 | 30 | 60>(5);
  const [snapshots, setSnapshots] = useState<MonitoringSnapshotDoc[]>([]);
  const [savingSnap, setSavingSnap] = useState(false);

  const windowSamples = samples.filter((s) => s.timestamp >= Date.now() - range * 60_000);
  const validLatencies = windowSamples
    .map((s) => s.latencyMs)
    .filter((v): v is number => v !== null);
  const latestSample = samples[samples.length - 1] ?? null;
  const avgLatency = validLatencies.length
    ? validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length
    : null;
  const minLatency = validLatencies.length ? Math.min(...validLatencies) : null;
  const maxLatency = validLatencies.length ? Math.max(...validLatencies) : null;
  const onlinePercent =
    windowSamples.length > 0
      ? (windowSamples.filter((s) => s.online).length / windowSamples.length) * 100
      : null;

  const loadSnapshots = useCallback(async () => {
    if (!user || !emailVerified || !cloudAllowed) return;
    try {
      const list = await fetchMonitoringSnapshots(user.uid, 20);
      setSnapshots(list);
    } catch {
      // Non-blocking cloud read
    }
  }, [cloudAllowed, emailVerified, user]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleSaveSnapshot = async () => {
    if (!user || !emailVerified) {
      onRequireAuth?.();
      return;
    }
    if (!cloudAllowed) {
      onUpgrade?.();
      return;
    }
    if (windowSamples.length === 0 || avgLatency === null || onlinePercent === null) {
      onNotify?.(
        'warning',
        isAr ? 'لا توجد عينات كافية بعد' : 'Not enough monitoring samples yet',
        isAr
          ? 'انتظر حتى يتم جمع عينات استجابة حية أولاً.'
          : 'Wait for live HTTP heartbeat samples to populate first.',
      );
      return;
    }

    setSavingSnap(true);
    try {
      const id = `mon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await saveMonitoringSnapshot(user.uid, {
        id,
        avgLatencyMs: Number(avgLatency.toFixed(1)),
        ...(minLatency !== null ? { minLatencyMs: Number(minLatency.toFixed(1)) } : {}),
        ...(maxLatency !== null ? { maxLatencyMs: Number(maxLatency.toFixed(1)) } : {}),
        interruptions: interruptionsCount,
        onlinePercent: Number(onlinePercent.toFixed(1)),
        sampleCount: windowSamples.length,
      });
      onNotify?.(
        'success',
        isAr ? 'تم حفظ لقطة المراقبة سحابياً' : 'Cloud uptime snapshot saved',
      );
      await loadSnapshots();
    } catch (err) {
      onNotify?.(
        'error',
        isAr ? 'تعذر حفظ اللقطة السحابية' : 'Failed to save snapshot',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingSnap(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#F4F7FF]">
            {t.monitoringPage.title}
          </h2>
          <p className="text-sm text-[#9EACC4] mt-0.5">{t.monitoringPage.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={savingSnap}
            onClick={handleSaveSnapshot}
            className="flex items-center gap-1.5 rounded-xl nv-btn-primary px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {cloudAllowed ? <CloudUpload className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
            <span>
              {savingSnap
                ? isAr
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : cloudAllowed
                  ? isAr
                    ? 'حفظ لقطة سحابية'
                    : 'Save Cloud Snapshot'
                  : isAr
                    ? 'ترقية لحفظ اللقطات السحابية'
                    : 'Pro: Save Cloud Snapshot'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMonitoring}
            className="flex items-center gap-2 rounded-xl border border-[#263650] bg-[#121D32] px-4 py-2 text-xs font-semibold text-[#F4F7FF] hover:bg-[#192640]"
          >
            {monitoringActive ? (
              <Pause className="h-3.5 w-3.5 text-[#F5B942]" />
            ) : (
              <Play className="h-3.5 w-3.5 text-[#22C58B]" />
            )}
            <span>{monitoringActive ? t.monitoringPage.pause : t.monitoringPage.resume}</span>
          </button>

          <button
            type="button"
            onClick={onClearSamples}
            className="flex items-center gap-2 rounded-xl border border-[#263650] bg-[#121D32] px-3.5 py-2 text-xs font-medium text-[#9EACC4] hover:text-[#DF475E]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.monitoringPage.clearSamples}</span>
          </button>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nv-card p-4">
          <div className="text-xs text-[#9EACC4]">{t.monitoringPage.currentLatency}</div>
          <div className="mt-1 text-2xl font-bold text-[#F4F7FF] font-mono-tabular">
            {latestSample?.latencyMs !== null && latestSample?.latencyMs !== undefined
              ? `${latestSample.latencyMs} ms`
              : '—'}
          </div>
        </div>

        <div className="nv-card p-4">
          <div className="text-xs text-[#9EACC4]">{t.monitoringPage.avgLatency}</div>
          <div className="mt-1 text-2xl font-bold text-[#08C8F0] font-mono-tabular">
            {avgLatency !== null ? `${avgLatency.toFixed(1)} ms` : '—'}
          </div>
        </div>

        <div className="nv-card p-4">
          <div className="text-xs text-[#9EACC4]">
            {isAr ? 'نسبة التشغيل (Uptime %)' : 'Session Uptime %'}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#22e06b] font-mono-tabular">
            {onlinePercent !== null ? `${onlinePercent.toFixed(1)}%` : '—'}
          </div>
        </div>

        <div className="nv-card p-4">
          <div className="text-xs text-[#9EACC4]">{t.monitoringPage.interruptions}</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#F4F7FF] font-mono-tabular">
            {interruptionsCount > 0 && <WifiOff className="h-5 w-5 text-[#F06478]" />}
            <span>{interruptionsCount}</span>
          </div>
        </div>
      </div>

      {/* Time Range Selector + Charts */}
      <section className="nv-card p-5 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#08C8F0]" />
            <h3 className="font-display text-sm font-bold text-[#F4F7FF]">
              {t.monitoringPage.latencyChartTitle}
            </h3>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-[#0E1628] p-1">
            {([1, 5, 15, 30, 60] as const).map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setRange(min)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  range === min
                    ? 'bg-[#192640] text-[#F4F7FF] shadow-xs'
                    : 'text-[#9EACC4] hover:text-white'
                }`}
              >
                {language === 'ar' ? (min === 60 ? '1 س' : `${min} د`) : min === 60 ? '1h' : `${min}m`}
              </button>
            ))}
          </div>
        </div>

        <TrafficChart
          samples={samples}
          rangeMinutes={range}
          mode="latency"
          emptyLabel={t.monitoringPage.noSamplesYet}
          primaryLabel={t.monitoringPage.latencyChartTitle}
          secondaryLabel=""
          height={210}
        />

        <div className="pt-4 border-t border-[#263650]">
          <h3 className="font-display text-sm font-bold text-[#F4F7FF] mb-3">
            {t.monitoringPage.activityChartTitle}
          </h3>
          <TrafficChart
            samples={samples}
            rangeMinutes={range}
            mode="activity"
            emptyLabel={t.monitoringPage.noSamplesYet}
            primaryLabel={t.dashboard.downloadSpeed}
            secondaryLabel={t.dashboard.uploadSpeed}
            height={180}
          />
        </div>
      </section>

      {/* Cloud Monitoring Snapshots History */}
      {user && emailVerified && cloudAllowed && (
        <section className="nv-card p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#eef0ff]">
              {isAr ? 'سجل لقطات المراقبة السحابية (Uptime Snapshots)' : 'Saved Cloud Uptime Snapshots'}
            </h3>
            <span className="font-mono-tabular text-[#9aa0d6]">{snapshots.length}</span>
          </div>

          {snapshots.length === 0 ? (
            <p className="text-[#9aa0d6]">
              {isAr
                ? 'اضغط "حفظ لقطة سحابية" لتوثيق متوسط الاستقرار ونسبة التشغيل.'
                : 'Click "Save Cloud Snapshot" above to archive live uptime telemetry in your account.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono-tabular">
                <thead>
                  <tr className="border-b border-[#262a6b] text-[#9aa0d6]">
                    <th className="py-2 text-start font-sans">{isAr ? 'التوقيت' : 'Timestamp'}</th>
                    <th className="py-2 text-end">{isAr ? 'نسبة التشغيل' : 'Uptime %'}</th>
                    <th className="py-2 text-end">{isAr ? 'متوسط Ping' : 'Avg RTT'}</th>
                    <th className="py-2 text-end">{isAr ? 'أدنى / أقصى' : 'Min / Max'}</th>
                    <th className="py-2 text-end">{isAr ? 'الانقطاعات' : 'Drops'}</th>
                    <th className="py-2 text-end">{isAr ? 'العينات' : 'Samples'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262a6b]/40 text-[#eef0ff]">
                  {snapshots.map((snap) => {
                    const sec = (snap.createdAt as { seconds?: number } | undefined)?.seconds;
                    const dateLabel = sec ? new Date(sec * 1000).toLocaleString() : snap.id;
                    return (
                      <tr key={snap.id}>
                        <td className="py-2 font-sans">{dateLabel}</td>
                        <td className="py-2 text-end text-[#22e06b] font-bold">{snap.onlinePercent.toFixed(1)}%</td>
                        <td className="py-2 text-end text-[#18c8ff]">{snap.avgLatencyMs.toFixed(1)} ms</td>
                        <td className="py-2 text-end text-[#9aa0d6]">
                          {snap.minLatencyMs ?? '—'} / {snap.maxLatencyMs ?? '—'} ms
                        </td>
                        <td className="py-2 text-end text-[#f06478]">{snap.interruptions}</td>
                        <td className="py-2 text-end">{snap.sampleCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Browser Measurement Boundary Disclosure */}
      <div className="rounded-2xl border border-[#263650] bg-[#0E1628] p-4 flex items-start gap-3 text-xs text-[#9EACC4]">
        <Info className="h-4 w-4 text-[#08C8F0] shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-[#F4F7FF]">{t.monitoringPage.browserLimitTitle}</div>
          <p className="mt-1 leading-relaxed">{t.monitoringPage.browserLimitDesc}</p>
          <p className="mt-1 text-[#9EACC4]/80">{t.monitoringPage.desktopAdapterReady}</p>
        </div>
      </div>
    </div>
  );
};
