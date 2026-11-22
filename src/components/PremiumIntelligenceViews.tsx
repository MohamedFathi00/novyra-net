import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Gamepad2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import type {
  AlertRuleDoc,
  ConnectionInfo,
  Language,
  ServerNode,
  SpeedTestResult,
} from '../types/network';
import { useAuth } from '../context/AuthContext';
import { canUseFeature } from '../services/entitlementService';
import {
  deleteAlertRule,
  fetchAlertRules,
  saveAlertRule,
  toggleAlertRule,
} from '../services/cloudSyncService';
import { PremiumFeatureLock } from './PremiumFeatureLock';

interface GamingModeViewProps {
  language: Language;
  latestTest: SpeedTestResult | null;
  history: SpeedTestResult[];
  servers: ServerNode[];
  connectionInfo: ConnectionInfo;
  onStartTest: () => void;
  onUpgrade: () => void;
  onRequireAuth: () => void;
}

interface AutomatedDiagnosisFinding {
  id: string;
  severity: 'ok' | 'warn' | 'critical';
  kind: 'confirmed' | 'advisory';
  title: string;
  detail: string;
}

export const GamingModeView: React.FC<GamingModeViewProps> = ({
  language,
  latestTest,
  history,
  servers,
  connectionInfo,
  onStartTest,
  onUpgrade,
  onRequireAuth,
}) => {
  const isAr = language === 'ar';
  const { user, entitlements, featureFlags } = useAuth();
  const allowed = canUseFeature('gaming_mode', entitlements, featureFlags);

  const [stepDone, setStepDone] = useState<Record<string, boolean>>({});
  const [tcpPingProbe, setTcpPingProbe] = useState<{
    host: string;
    avgMs: number | null;
    jitterMs: number | null;
    loss: number | null;
  } | null>(null);
  const [probingHost, setProbingHost] = useState(false);

  const [runningAutoDiag, setRunningAutoDiag] = useState(false);
  const [autoDiagFindings, setAutoDiagFindings] = useState<AutomatedDiagnosisFinding[] | null>(null);

  const completedHistory = useMemo(
    () => history.filter((r) => r.status === 'completed'),
    [history],
  );

  const ispStats = useMemo(() => {
    const byIsp = new Map<string, { count: number; dlSum: number; pingSum: number; jitterSum: number }>();
    for (const rec of completedHistory) {
      const key = rec.isp || (isAr ? 'مزود غير محدد' : 'Unknown ISP');
      const cur = byIsp.get(key) ?? { count: 0, dlSum: 0, pingSum: 0, jitterSum: 0 };
      cur.count += 1;
      cur.dlSum += rec.downloadMbps;
      cur.pingSum += rec.pingMs;
      cur.jitterSum += rec.jitterMs;
      byIsp.set(key, cur);
    }
    return Array.from(byIsp.entries()).map(([isp, v]) => ({
      isp,
      count: v.count,
      avgDownload: v.dlSum / v.count,
      avgPing: v.pingSum / v.count,
      avgJitter: v.jitterSum / v.count,
    }));
  }, [completedHistory, isAr]);

  const timeOfDayBuckets = useMemo(() => {
    const defs = [
      { id: 'dawn', start: 0, end: 6, label: isAr ? 'فجراً (00–06)' : 'Dawn (00–06)' },
      { id: 'morning', start: 6, end: 12, label: isAr ? 'صباحاً (06–12)' : 'Morning (06–12)' },
      { id: 'afternoon', start: 12, end: 18, label: isAr ? 'ظهراً (12–18)' : 'Afternoon (12–18)' },
      { id: 'evening', start: 18, end: 24, label: isAr ? 'ذروة المساء (18–24)' : 'Evening Peak (18–24)' },
    ];
    return defs.map((bucket) => {
      const items = completedHistory.filter((rec) => {
        const h = new Date(rec.timestamp).getHours();
        return h >= bucket.start && h < bucket.end;
      });
      if (items.length === 0) {
        return { ...bucket, count: 0, avgDownload: 0, avgPing: 0, avgJitter: 0 };
      }
      return {
        ...bucket,
        count: items.length,
        avgDownload: items.reduce((s, r) => s + r.downloadMbps, 0) / items.length,
        avgPing: items.reduce((s, r) => s + r.pingMs, 0) / items.length,
        avgJitter: items.reduce((s, r) => s + r.jitterMs, 0) / items.length,
      };
    });
  }, [completedHistory, isAr]);

  const maxSlotDownload = Math.max(10, ...timeOfDayBuckets.map((b) => b.avgDownload));
  const maxSlotPing = Math.max(20, ...timeOfDayBuckets.map((b) => b.avgPing));

  if (!allowed) {
    return (
      <PremiumFeatureLock
        language={language}
        featureTitle="Gaming Mode, ISP Tracker & Smart Troubleshooting"
        featureTitleAr="وضع الألعاب وتتبع أداء مزود الإنترنت والتشخيص الموجه"
        description="Unlock competitive latency/jitter grading, time-of-day stability charts, live edge routing checks, ISP benchmarks, and automated troubleshooting diagnostics with NOVYRA Pro."
        descriptionAr="افتح تقييم الألعاب التنافسي، رسوم استقرار الاتصال حسب أوقات اليوم، مقارنة أداء مزود الإنترنت، وفحص التشخيص الذكي التلقائي مع NOVYRA Pro."
        requiredPlan="pro"
        currentPlan={entitlements.planId}
        isSignedIn={Boolean(user)}
        onUpgrade={onUpgrade}
        onSignIn={onRequireAuth}
      />
    );
  }

  const ping = latestTest?.pingMs ?? null;
  const jitter = latestTest?.jitterMs ?? null;
  const loss = latestTest?.probeLossPercent ?? null;
  const dlLatencyDelta =
    latestTest && latestTest.downloadLatencyMs !== null
      ? Math.max(0, latestTest.downloadLatencyMs - latestTest.pingMs)
      : null;

  const gamingVerdict = (() => {
    if (!latestTest) return isAr ? 'أجرِ اختبار سرعة لتقييم الألعاب' : 'Run a test to evaluate Gaming Mode';
    if (latestTest.pingMs <= 35 && latestTest.jitterMs <= 8 && (loss ?? 0) === 0) {
      return isAr ? 'ممتاز للألعاب التنافسية (FPS / MOBA)' : 'Optimal for Competitive Gaming (FPS / MOBA)';
    }
    if (latestTest.pingMs <= 70 && latestTest.jitterMs <= 20) {
      return isAr ? 'جيد للألعاب الجماعية عبر الإنترنت' : 'Good for Online Multiplayer Gaming';
    }
    return isAr ? 'يوجد تأخير أو تذبذب قد يؤثر على الاستجابة' : 'High Latency/Jitter Detected for Fast-Paced Play';
  })();

  const runEdgeProbe = async (host: string) => {
    setProbingHost(true);
    try {
      const res = await fetch('/api/diagnostics/tcp-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: 443, count: 5 }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setTcpPingProbe({
          host,
          avgMs: data.summary.avgMs,
          jitterMs: data.summary.jitterMs,
          loss: data.summary.lossPercent,
        });
      }
    } finally {
      setProbingHost(false);
    }
  };

  const runAutomatedDiagnostics = async () => {
    setRunningAutoDiag(true);
    const findings: AutomatedDiagnosisFinding[] = [];

    // 1. Connectivity & interface check
    findings.push({
      id: 'online',
      severity: connectionInfo.online ? 'ok' : 'critical',
      kind: 'confirmed',
      title: isAr ? 'حالة الاتصال بالشبكة' : 'Network Interface Online Check',
      detail: connectionInfo.online
        ? isAr
          ? `المتصفح متصل بالإنترنت (${connectionInfo.connectionType || connectionInfo.effectiveType || 'واجهة غير مصرح عنها'}).`
          : `Online (${connectionInfo.connectionType || connectionInfo.effectiveType || 'Interface unspecified by browser'}).`
        : isAr
          ? 'الجهاز غير متصل بالشبكة حالياً.'
          : 'Device reports offline status.',
    });

    // 2. Bufferbloat inspection from real test
    if (dlLatencyDelta !== null) {
      findings.push({
        id: 'bufferbloat',
        severity: dlLatencyDelta > 60 ? 'critical' : dlLatencyDelta > 25 ? 'warn' : 'ok',
        kind: 'confirmed',
        title: isAr ? 'قياس Bufferbloat تحت ضغط التحميل' : 'Loaded Latency (Bufferbloat Delta)',
        detail:
          dlLatencyDelta > 60
            ? isAr
              ? `ارتفاع ملحوظ +${dlLatencyDelta.toFixed(1)} ms أثناء التحميل — يسبب تقطيعاً عند تحميل آخرين للشبكة.`
              : `Severe +${dlLatencyDelta.toFixed(1)} ms spike under download load.`
            : isAr
              ? `ارتفاع مقبول (+${dlLatencyDelta.toFixed(1)} ms) تحت الحمل.`
              : `Controlled +${dlLatencyDelta.toFixed(1)} ms latency delta under load.`,
      });
    }

    // 3. Real TCP Ping to Cloudflare & Google edges + Real DNS latency
    try {
      const [cfRes, ggRes, dnsRes] = await Promise.all([
        fetch('/api/diagnostics/tcp-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: '1.1.1.1', port: 443, count: 4 }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/diagnostics/tcp-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: '8.8.8.8', port: 443, count: 4 }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/diagnostics/dns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: 'cloudflare.com', types: ['A'] }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      const cfAvg: number | null = cfRes?.summary?.avgMs ?? null;
      const ggAvg: number | null = ggRes?.summary?.avgMs ?? null;
      if (cfAvg !== null || ggAvg !== null) {
        const cfLoss = cfRes?.summary?.lossPercent ?? 0;
        const bestMs = Math.min(cfAvg ?? Infinity, ggAvg ?? Infinity);
        findings.push({
          id: 'edge_tcp',
          severity: cfLoss > 0 || bestMs > 120 ? 'warn' : 'ok',
          kind: 'confirmed',
          title: isAr ? 'استجابة المسار الخارجي (TCP 443)' : 'Upstream Anycast Routing (TCP 443)',
          detail: isAr
            ? `1.1.1.1: ${cfAvg?.toFixed(1) ?? '—'} ms · 8.8.8.8: ${ggAvg?.toFixed(1) ?? '—'} ms (فقدان ${cfLoss}%).`
            : `1.1.1.1: ${cfAvg?.toFixed(1) ?? '—'} ms · 8.8.8.8: ${ggAvg?.toFixed(1) ?? '—'} ms (${cfLoss}% loss).`,
        });
      }

      if (dnsRes && typeof dnsRes.durationMs === 'number') {
        const dur = dnsRes.durationMs;
        findings.push({
          id: 'dns_timing',
          severity: dur > 200 ? 'warn' : 'ok',
          kind: 'confirmed',
          title: isAr ? 'سرعة استعلام DNS' : 'DNS Resolution Latency',
          detail: isAr
            ? `استغرق الاستعلام ${dur} ms لحل النطاق cloudflare.com.`
            : `Resolved cloudflare.com in ${dur} ms.`,
        });
      }
    } finally {
      // 4. Probable root-cause advisory
      if (latestTest && (latestTest.jitterMs > 15 || (dlLatencyDelta ?? 0) > 40)) {
        findings.push({
          id: 'probable_wifi',
          severity: 'warn',
          kind: 'advisory',
          title: isAr ? 'توصية محتملة لتقليل التذبذب' : 'Probable Bottleneck Optimization',
          detail: isAr
            ? 'تشير القيم إلى احتمال تداخل لاسلكي Wi-Fi أو امتلاء طوابير الراوتر؛ جرّب التوصيل بكابل Ethernet وتفعيل QoS / SQM.'
            : 'Jitter / load spike suggests wireless contention or router queuebloat; consider wired Ethernet or enabling SQM/QoS.',
        });
      } else {
        findings.push({
          id: 'probable_ok',
          severity: 'ok',
          kind: 'advisory',
          title: isAr ? 'تقييم الجاهزية العام' : 'Overall Routing Readiness',
          detail: isAr
            ? 'لم تُرصد اختناقات حادة في المسار أو DNS في الفحص الحالي.'
            : 'No critical DNS or upstream TCP bottlenecks detected in this probe.',
        });
      }
      setAutoDiagFindings(findings);
      setRunningAutoDiag(false);
    }
  };

  const troubleshootSteps = [
    {
      id: 'c1',
      title: isAr ? '1. مقارنة التوصيل السلكي مقابل Wi-Fi' : '1. Wired Ethernet vs Wi-Fi Check',
      desc: isAr
        ? `نوع الاتصال الحالي الملاحظ: ${connectionInfo.connectionType || connectionInfo.effectiveType || 'غير محدد'}. يُنصح بكابل Ethernet للألعاب التنافسية لتقليل Jitter.`
        : `Observed connection: ${connectionInfo.connectionType || connectionInfo.effectiveType || 'Unspecified'}. Wired Ethernet reduces wireless frame jitter.`,
    },
    {
      id: 'c2',
      title: isAr ? '2. التحقق من Bufferbloat تحت الضغط' : '2. Loaded Latency / Bufferbloat Check',
      desc:
        dlLatencyDelta !== null
          ? isAr
            ? `ارتفاع البنج أثناء التحميل: +${dlLatencyDelta.toFixed(1)} ms. إذا تجاوز +40 ms يُنصح بتفعيل QoS / SQM في الراوتر.`
            : `Latency delta under download load: +${dlLatencyDelta.toFixed(1)} ms. Above +40 ms suggests enabling Router QoS/SQM.`
          : isAr
            ? 'أجرِ اختباراً حديثاً لقياس فرق البنج تحت التحميل.'
            : 'Run a test to inspect latency delta under throughput load.',
    },
    {
      id: 'c3',
      title: isAr ? '3. اختيار أقرب عقدة DNS سريعة' : '3. Compare Global Anycast Latency',
      desc: isAr
        ? 'جرّب فحص استجابة 1.1.1.1 و 8.8.8.8 و 9.9.9.9 في الأسفل لاختيار أسرع مسار.'
        : 'Probe 1.1.1.1, 8.8.8.8, and 9.9.9.9 edges below to inspect direct TCP RTT.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 text-[#eef0ff]">
            <Gamepad2 className="h-5 w-5 text-[#18c8ff]" />
            <span>{isAr ? 'وضع الألعاب وتتبع ISP والتشخيص الموجه' : 'Gaming Mode, ISP Tracker & Smart Troubleshooting'}</span>
          </h2>
          <p className="text-xs text-[#9aa0d6] mt-0.5">{gamingVerdict}</p>
        </div>

        <button
          type="button"
          onClick={onStartTest}
          className="inline-flex items-center gap-2 rounded-xl nv-btn-primary px-4 py-2 text-xs font-bold"
        >
          <Play className="h-3.5 w-3.5" />
          <span>{isAr ? 'تشغيل اختبار ألعاب الآن' : 'Run Gaming Benchmark'}</span>
        </button>
      </div>

      {/* Live Gaming Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="nv-card p-4">
          <div className="text-[#9aa0d6]">{isAr ? 'البنج في الخمول (Idle Ping)' : 'Idle Ping'}</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-[#18c8ff] mt-1">
            {ping !== null ? `${ping.toFixed(1)} ms` : '—'}
          </div>
        </div>
        <div className="nv-card p-4">
          <div className="text-[#9aa0d6]">{isAr ? 'التذبذب (Jitter)' : 'Jitter'}</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-[#a855f7] mt-1">
            {jitter !== null ? `${jitter.toFixed(1)} ms` : '—'}
          </div>
        </div>
        <div className="nv-card p-4">
          <div className="text-[#9aa0d6]">{isAr ? 'فقدان النبضات' : 'Probe Loss'}</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-[#22e06b] mt-1">
            {loss !== null ? `${loss}%` : '—'}
          </div>
        </div>
        <div className="nv-card p-4">
          <div className="text-[#9aa0d6]">{isAr ? 'ارتفاع البنج تحت الحمل' : 'Bufferbloat Delta'}</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-[#f5b942] mt-1">
            {dlLatencyDelta !== null ? `+${dlLatencyDelta.toFixed(1)} ms` : '—'}
          </div>
        </div>
      </div>

      {/* Edge Server TCP Probes & Smart Troubleshooting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
        <div className="nv-card p-5 lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#18c8ff]" />
            <h3 className="font-display text-sm font-bold text-[#eef0ff]">
              {isAr ? 'فحص استجابة عقد الألعاب والـ DNS (TCP 443)' : 'Live Edge TCP Probe Comparison'}
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {['1.1.1.1', '8.8.8.8', '9.9.9.9'].map((host) => (
              <button
                key={host}
                type="button"
                disabled={probingHost}
                onClick={() => runEdgeProbe(host)}
                className="rounded-xl border border-[#262a6b] bg-[#0d1033] px-3 py-2 font-mono-tabular font-bold text-[#eef0ff] hover:border-[#18c8ff] disabled:opacity-50"
              >
                {isAr ? `فحص ${host}` : `Probe ${host}`}
              </button>
            ))}
          </div>

          {tcpPingProbe && (
            <div className="nv-inner p-3.5 flex flex-wrap gap-4 font-mono-tabular text-[#eef0ff]">
              <span>{isAr ? `المضيف: ${tcpPingProbe.host}` : `Host: ${tcpPingProbe.host}`}</span>
              <span className="text-[#18c8ff]">
                {isAr ? 'المتوسط:' : 'Avg:'} {tcpPingProbe.avgMs?.toFixed(1) ?? '—'} ms
              </span>
              <span className="text-[#a855f7]">
                {isAr ? 'التذبذب:' : 'Jitter:'} {tcpPingProbe.jitterMs?.toFixed(1) ?? '—'} ms
              </span>
              <span>
                {isAr ? 'الفقدان:' : 'Loss:'} {tcpPingProbe.loss ?? 0}%
              </span>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <div className="font-semibold text-[#9aa0d6]">
              {isAr ? 'العقد المهيأة حالياً:' : 'Configured Monitor Nodes:'}
            </div>
            {servers.map((srv) => (
              <div key={srv.id} className="nv-inner px-3 py-2 flex items-center justify-between text-[#eef0ff]">
                <span>{isAr ? srv.nameAr : srv.name}</span>
                <span className="font-mono-tabular font-bold text-[#18c8ff]">
                  {srv.latencyMs !== null
                    ? `${srv.latencyMs} ms`
                    : isAr
                      ? srv.status === 'online'
                        ? 'متصل'
                        : srv.status === 'unreachable'
                          ? 'غير متاح'
                          : 'غير مفحوص'
                      : srv.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="nv-card p-5 lg:col-span-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#a855f7]" />
              <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                {isAr ? 'سير عمل التشخيص الذكي' : 'Smart Troubleshooting Workflow'}
              </h3>
            </div>
            <button
              type="button"
              disabled={runningAutoDiag}
              onClick={runAutomatedDiagnostics}
              className="inline-flex items-center gap-1.5 rounded-xl nv-btn-primary px-3 py-1.5 text-[11px] font-bold disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${runningAutoDiag ? 'animate-spin' : ''}`} />
              <span>
                {runningAutoDiag
                  ? isAr
                    ? 'جاري الفحص...'
                    : 'Diagnosing...'
                  : isAr
                    ? 'تشغيل الفحص التلقائي'
                    : 'Run Auto-Diagnosis'}
              </span>
            </button>
          </div>

          {autoDiagFindings && (
            <div className="space-y-2 pt-1">
              {autoDiagFindings.map((f) => (
                <div
                  key={f.id}
                  className={`rounded-xl border p-3 ${
                    f.severity === 'critical'
                      ? 'border-[#f06478]/50 bg-[#f06478]/10'
                      : f.severity === 'warn'
                        ? 'border-[#f5b942]/45 bg-[#f5b942]/10'
                        : 'border-[#22e06b]/40 bg-[#22e06b]/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-[#eef0ff]">
                    <span className="flex items-center gap-1.5">
                      {f.severity === 'ok' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#22e06b]" />
                      ) : (
                        <AlertTriangle
                          className={`h-3.5 w-3.5 ${f.severity === 'critical' ? 'text-[#f06478]' : 'text-[#f5b942]'}`}
                        />
                      )}
                      {f.title}
                    </span>
                    <span className="rounded bg-[#0a0d33]/80 px-2 py-0.5 text-[10px] font-mono-tabular uppercase text-[#cfd3ff]">
                      {f.kind === 'confirmed'
                        ? isAr
                          ? 'قياس مؤكد'
                          : 'CONFIRMED'
                        : isAr
                          ? 'توصية محتملة'
                          : 'ADVISORY'}
                    </span>
                  </div>
                  <p className="text-[#cfd3ff] mt-1 leading-relaxed">{f.detail}</p>
                </div>
              ))}
            </div>
          )}

          {troubleshootSteps.map((st) => {
            const done = Boolean(stepDone[st.id]);
            return (
              <div
                key={st.id}
                onClick={() => setStepDone((p) => ({ ...p, [st.id]: !p[st.id] }))}
                className={`nv-inner p-3.5 cursor-pointer transition-colors ${done ? 'border-[#22e06b]/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 font-bold text-[#eef0ff]">
                  <span>{st.title}</span>
                  {done && <CheckCircle2 className="h-4 w-4 text-[#22e06b]" />}
                </div>
                <p className="text-[#cfd3ff] mt-1 leading-relaxed">{st.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time-of-Day Stability Charts (Computed from Real Completed History) */}
      <div className="nv-card p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#18c8ff]" />
            <h3 className="font-display text-sm font-bold text-[#eef0ff]">
              {isAr ? 'رسوم استقرار الاتصال عبر أوقات اليوم' : 'Time-of-Day Stability Charts'}
            </h3>
          </div>
          <span className="text-[11px] font-mono-tabular text-[#9aa0d6]">
            {isAr ? `${completedHistory.length} اختبار مكتمل` : `${completedHistory.length} completed samples`}
          </span>
        </div>

        {completedHistory.length === 0 ? (
          <p className="text-[#9aa0d6]">
            {isAr
              ? 'أجرِ اختبارات سرعة في أوقات مختلفة من اليوم لمقارنة استقرار التحميل والبنج والتذبذب عبر الفترات.'
              : 'Run completed speed tests across different hours to visualize Dawn, Morning, Afternoon, and Evening Peak stability.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {timeOfDayBuckets.map((slot) => (
              <div key={slot.id} className="nv-inner p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#eef0ff]">{slot.label}</span>
                  <span className="font-mono-tabular text-[11px] text-[#9aa0d6]">
                    {slot.count} {isAr ? 'اختبار' : 'tests'}
                  </span>
                </div>

                {slot.count === 0 ? (
                  <div className="py-3 text-[11px] text-[#9aa0d6]/70">
                    {isAr ? 'لا توجد قياسات في هذه الفترة' : 'No samples in window'}
                  </div>
                ) : (
                  <div className="space-y-2 font-mono-tabular">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#9aa0d6]">{isAr ? 'متوسط التحميل' : 'Avg DL'}</span>
                        <span className="text-[#18c8ff] font-bold">{slot.avgDownload.toFixed(1)} Mbps</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1b2059] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#18c8ff]"
                          style={{ width: `${Math.min(100, (slot.avgDownload / maxSlotDownload) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#9aa0d6]">{isAr ? 'متوسط Ping / Jitter' : 'Ping / Jitter'}</span>
                        <span className="text-[#a855f7] font-bold">
                          {slot.avgPing.toFixed(0)} / {slot.avgJitter.toFixed(1)} ms
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1b2059] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#a855f7]"
                          style={{ width: `${Math.min(100, (slot.avgPing / maxSlotPing) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ISP Performance Tracker (Computed from Saved History) */}
      <div className="nv-card p-5 space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#22e06b]" />
          <h3 className="font-display text-sm font-bold text-[#eef0ff]">
            {isAr ? 'متتبع أداء مزود الخدمة (ISP Tracker)' : 'ISP Performance Tracker (From Saved Tests)'}
          </h3>
        </div>

        {ispStats.length === 0 ? (
          <p className="text-[#9aa0d6]">
            {isAr ? 'أجرِ اختبارات سرعة لبناء مقارنة أداء مزودي الخدمة.' : 'Run speed tests to compute ISP averages.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono-tabular">
              <thead>
                <tr className="text-[#9aa0d6] border-b border-[#262a6b]">
                  <th className="py-2 text-start font-sans">{isAr ? 'مزود الخدمة' : 'ISP'}</th>
                  <th className="py-2 text-end">{isAr ? 'الاختبارات' : 'Tests'}</th>
                  <th className="py-2 text-end">{isAr ? 'متوسط التحميل' : 'Avg Download'}</th>
                  <th className="py-2 text-end">{isAr ? 'متوسط Ping' : 'Avg Ping'}</th>
                  <th className="py-2 text-end">{isAr ? 'متوسط Jitter' : 'Avg Jitter'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262a6b]/40">
                {ispStats.map((row) => (
                  <tr key={row.isp}>
                    <td className="py-2.5 font-sans font-semibold text-[#eef0ff]">{row.isp}</td>
                    <td className="py-2.5 text-end text-[#cfd3ff]">{row.count}</td>
                    <td className="py-2.5 text-end text-[#18c8ff] font-bold">{row.avgDownload.toFixed(1)} Mbps</td>
                    <td className="py-2.5 text-end text-[#cfd3ff]">{row.avgPing.toFixed(1)} ms</td>
                    <td className="py-2.5 text-end text-[#a855f7]">{row.avgJitter.toFixed(1)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface AlertsRulesViewProps {
  language: Language;
  onUpgrade: () => void;
  onRequireAuth: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string) => void;
}

export const AlertsRulesView: React.FC<AlertsRulesViewProps> = ({
  language,
  onUpgrade,
  onRequireAuth,
  onNotify,
}) => {
  const isAr = language === 'ar';
  const { user, emailVerified, entitlements, featureFlags } = useAuth();
  const allowed = canUseFeature('custom_alerts', entitlements, featureFlags);

  const [rules, setRules] = useState<AlertRuleDoc[]>([]);
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<AlertRuleDoc['metric']>('download_mbps');
  const [operator, setOperator] = useState<AlertRuleDoc['operator']>('lt');
  const [threshold, setThreshold] = useState(25);

  const loadRules = useCallback(async () => {
    if (!user || !emailVerified || !allowed) return;
    try {
      const list = await fetchAlertRules(user.uid);
      setRules(list);
    } catch {
      // Handled upstream
    }
  }, [allowed, emailVerified, user]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  if (!allowed) {
    return (
      <PremiumFeatureLock
        language={language}
        featureTitle="Custom Network Alert Thresholds"
        featureTitleAr="قواعد التنبيه المخصصة لمراقبة جودة الاتصال"
        description="Configure cloud-synced rules that trigger instant notifications when download drops or latency/jitter spikes beyond your thresholds."
        descriptionAr="أنشئ قواعد تنبيه محفوظة سحابياً لإشعارك فوراً عند انخفاض السرعة أو ارتفاع البنج والـ Jitter."
        requiredPlan="pro"
        currentPlan={entitlements.planId}
        isSignedIn={Boolean(user)}
        onUpgrade={onUpgrade}
        onSignIn={onRequireAuth}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold flex items-center gap-2 text-[#eef0ff]">
          <Bell className="h-5 w-5 text-[#18c8ff]" />
          <span>{isAr ? 'قواعد التنبيه الذكية' : 'Custom Alert Threshold Rules'}</span>
        </h2>
        <p className="text-xs text-[#9aa0d6] mt-0.5">
          {isAr
            ? 'قواعد مخزنة في حسابك السحابي تُطبّق عند إتمام كل اختبار.'
            : 'Cloud-saved alert conditions evaluated automatically against incoming test metrics.'}
        </p>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user || !emailVerified) {
            onRequireAuth();
            return;
          }
          if (!name.trim()) return;
          const id = `alr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          try {
            await saveAlertRule(user.uid, {
              id,
              name: name.trim(),
              metric,
              operator,
              threshold,
              enabled: true,
              channel: 'in_app',
            });
            setName('');
            onNotify('success', isAr ? 'تمت إضافة قاعدة التنبيه' : 'Alert rule created');
            await loadRules();
          } catch (err) {
            onNotify(
              'error',
              err instanceof Error
                ? err.message
                : isAr
                  ? 'تعذر حفظ قاعدة التنبيه.'
                  : 'Failed to save alert rule.',
            );
          }
        }}
        className="nv-card p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end"
      >
        <div className="sm:col-span-2">
          <label className="block mb-1 text-[#9aa0d6]">{isAr ? 'اسم القاعدة' : 'Rule Name'}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isAr ? 'انخفاض سرعة العمل' : 'Slow Office Downlink'}
            className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
          />
        </div>
        <div>
          <label className="block mb-1 text-[#9aa0d6]">{isAr ? 'المعيار' : 'Metric'}</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as AlertRuleDoc['metric'])}
            className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
          >
            <option value="download_mbps">{isAr ? 'التحميل (Mbps)' : 'Download (Mbps)'}</option>
            <option value="upload_mbps">{isAr ? 'الرفع (Mbps)' : 'Upload (Mbps)'}</option>
            <option value="ping_ms">{isAr ? 'زمن الاستجابة Ping (ms)' : 'Ping (ms)'}</option>
            <option value="jitter_ms">{isAr ? 'التذبذب Jitter (ms)' : 'Jitter (ms)'}</option>
            <option value="packet_loss">{isAr ? 'نسبة الفقدان (%)' : 'Probe Loss (%)'}</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 text-[#9aa0d6]">{isAr ? 'الشرط والحد' : 'Condition & Value'}</label>
          <div className="flex gap-1.5">
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as 'lt' | 'gt')}
              className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-2 py-2 text-[#eef0ff]"
            >
              <option value="lt">&lt;</option>
              <option value="gt">&gt;</option>
            </select>
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-2.5 py-2 font-mono-tabular text-[#eef0ff]"
            />
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl nv-btn-primary py-2.5 px-4 font-bold"
        >
          <Plus className="h-4 w-4" />
          <span>{isAr ? 'إضافة' : 'Add Rule'}</span>
        </button>
      </form>

      <div className="nv-card p-5 space-y-2.5 text-xs">
        {rules.length === 0 ? (
          <div className="py-6 text-center text-[#9aa0d6]">
            {isAr ? 'لا توجد قواعد تنبيه مخصصة بعد.' : 'No custom alert rules configured yet.'}
          </div>
        ) : (
          rules.map((r) => {
            const metricLabel = isAr
              ? r.metric === 'download_mbps'
                ? 'التحميل (Mbps)'
                : r.metric === 'upload_mbps'
                  ? 'الرفع (Mbps)'
                  : r.metric === 'ping_ms'
                    ? 'Ping (ms)'
                    : r.metric === 'jitter_ms'
                      ? 'Jitter (ms)'
                      : 'نسبة الفقدان (%)'
              : r.metric;
            return (
              <div key={r.id} className="nv-inner px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-[#eef0ff]">{r.name}</div>
                  <div className="text-[11px] font-mono-tabular text-[#9aa0d6]">
                    {metricLabel} {r.operator === 'lt' ? '<' : '>'} {r.threshold}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      await toggleAlertRule(user.uid, r.id, !r.enabled);
                      await loadRules();
                    }}
                    className={`rounded-lg px-2.5 py-1 font-bold ${
                      r.enabled ? 'bg-[#22e06b]/15 text-[#22e06b]' : 'bg-slate-500/15 text-[#9aa0d6]'
                    }`}
                  >
                    {r.enabled ? (isAr ? 'نشط' : 'Active') : isAr ? 'متوقف' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      await deleteAlertRule(user.uid, r.id);
                      await loadRules();
                    }}
                    className="text-[#9aa0d6] hover:text-[#f06478]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
