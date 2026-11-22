import type { SpeedTestResult } from '../types/network';

export interface AnalyticsSummary {
  totalTests: number;
  avgDownloadMbps: number;
  avgUploadMbps: number;
  peakDownloadMbps: number;
  peakUploadMbps: number;
  avgPingMs: number;
  avgJitterMs: number;
  latencyConsistencyPercent: number;
}

export interface PeriodBucket {
  label: string;
  count: number;
  avgDownload: number;
  avgUpload: number;
  avgPing: number;
}

export interface ConnectionGroupStats {
  connectionType: string;
  count: number;
  avgDownload: number;
  avgUpload: number;
  avgPing: number;
}

export function computeAnalyticsSummary(records: SpeedTestResult[]): AnalyticsSummary | null {
  const completed = records.filter((r) => r.status === 'completed');
  if (completed.length === 0) return null;

  const totalTests = completed.length;
  const avgDownloadMbps = Number(
    (completed.reduce((s, r) => s + r.downloadMbps, 0) / totalTests).toFixed(2),
  );
  const avgUploadMbps = Number(
    (completed.reduce((s, r) => s + r.uploadMbps, 0) / totalTests).toFixed(2),
  );
  const peakDownloadMbps = Number(Math.max(...completed.map((r) => r.downloadMbps)).toFixed(2));
  const peakUploadMbps = Number(Math.max(...completed.map((r) => r.uploadMbps)).toFixed(2));
  const avgPingMs = Number((completed.reduce((s, r) => s + r.pingMs, 0) / totalTests).toFixed(1));
  const avgJitterMs = Number((completed.reduce((s, r) => s + r.jitterMs, 0) / totalTests).toFixed(1));

  // Consistency score derived strictly from jitter relative to ping
  const consistencyRaw = 100 - Math.min(80, avgJitterMs * 2.4 + (avgPingMs > 80 ? (avgPingMs - 80) * 0.25 : 0));
  const latencyConsistencyPercent = Math.max(15, Math.min(100, Math.round(consistencyRaw)));

  return {
    totalTests,
    avgDownloadMbps,
    avgUploadMbps,
    peakDownloadMbps,
    peakUploadMbps,
    avgPingMs,
    avgJitterMs,
    latencyConsistencyPercent,
  };
}

export function groupRecordsByPeriod(
  records: SpeedTestResult[],
  period: 'daily' | 'weekly' | 'monthly',
): PeriodBucket[] {
  const completed = [...records]
    .filter((r) => r.status === 'completed')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const buckets = new Map<string, SpeedTestResult[]>();

  for (const rec of completed) {
    const d = new Date(rec.timestamp);
    let key: string;
    if (period === 'daily') {
      key = d.toISOString().slice(0, 10);
    } else if (period === 'weekly') {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      key = `W ${startOfWeek.toISOString().slice(0, 10)}`;
    } else {
      key = d.toISOString().slice(0, 7);
    }
    const list = buckets.get(key) ?? [];
    list.push(rec);
    buckets.set(key, list);
  }

  return Array.from(buckets.entries()).map(([label, list]) => ({
    label,
    count: list.length,
    avgDownload: Number((list.reduce((s, r) => s + r.downloadMbps, 0) / list.length).toFixed(2)),
    avgUpload: Number((list.reduce((s, r) => s + r.uploadMbps, 0) / list.length).toFixed(2)),
    avgPing: Number((list.reduce((s, r) => s + r.pingMs, 0) / list.length).toFixed(1)),
  }));
}

export function groupRecordsByConnectionType(records: SpeedTestResult[]): ConnectionGroupStats[] {
  const completed = records.filter((r) => r.status === 'completed');
  const map = new Map<string, SpeedTestResult[]>();

  for (const r of completed) {
    const key = r.connectionType || r.effectiveType || 'Browser Default (Unspecified)';
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }

  return Array.from(map.entries()).map(([connectionType, list]) => ({
    connectionType,
    count: list.length,
    avgDownload: Number((list.reduce((s, r) => s + r.downloadMbps, 0) / list.length).toFixed(2)),
    avgUpload: Number((list.reduce((s, r) => s + r.uploadMbps, 0) / list.length).toFixed(2)),
    avgPing: Number((list.reduce((s, r) => s + r.pingMs, 0) / list.length).toFixed(1)),
  }));
}
