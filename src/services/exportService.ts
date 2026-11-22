import type { AppSettings, SpeedTestResult } from '../types/network';
import { exportBackupPayload } from './storageService';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportHistoryAsCsv(records: SpeedTestResult[]) {
  const headers = [
    'ID',
    'Timestamp',
    'Download (Mbps)',
    'Upload (Mbps)',
    'Ping (ms)',
    'Min Ping (ms)',
    'Max Ping (ms)',
    'Jitter (ms)',
    'Probe Loss (%)',
    'Server',
    'Connection Type',
    'Public IP',
    'ISP',
    'Status',
  ];

  const escape = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) =>
    [
      r.id,
      r.timestamp,
      r.downloadMbps,
      r.uploadMbps,
      r.pingMs,
      r.minPingMs,
      r.maxPingMs,
      r.jitterMs,
      r.probeLossPercent ?? 'Untested',
      r.serverName,
      r.connectionType ?? r.effectiveType ?? '',
      r.publicIp ?? '',
      r.isp ?? '',
      r.status,
    ]
      .map(escape)
      .join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(`novyra-net-history-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportBackupAsJson(records: SpeedTestResult[], settings: AppSettings) {
  const json = exportBackupPayload(records, settings);
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(`novyra-net-backup-${stamp}.json`, json, 'application/json;charset=utf-8');
}

export function printNetworkReport() {
  window.print();
}
