import type { AppSettings, SpeedTestResult } from '../types/network';

const HISTORY_KEY = 'novyra_net_v1_history';
const SETTINGS_KEY = 'novyra_net_v1_settings';
const CORRUPTED_BACKUP_KEY = 'novyra_net_v1_corrupted_raw';

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  language: 'ar',
  theme: 'dark',
  accent: 'electric',
  animationsEnabled: true,
  animationStyle: 'cyber',
  autoSelectServer: true,
  preferredServerId: 'novyra-core',
  testDurationSec: 10,
  maxPayloadMb: 16,
  autoSaveHistory: true,
  enablePublicIpLookup: true,
  monitoringIntervalSec: 5,
  alerts: {
    onDisconnect: true,
    lowDownloadThresholdMbps: 10,
    highLatencyThresholdMs: 120,
    enableBrowserNotifications: false,
  },
};

export interface StorageReadResult<T> {
  data: T;
  corrupted: boolean;
}

export function loadHistory(): StorageReadResult<SpeedTestResult[]> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { data: [], corrupted: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(CORRUPTED_BACKUP_KEY, raw);
      return { data: [], corrupted: true };
    }
    const valid = parsed.filter(
      (item): item is SpeedTestResult =>
        Boolean(item && typeof item.id === 'string' && typeof item.downloadMbps === 'number' && typeof item.timestamp === 'string'),
    );
    return { data: valid, corrupted: false };
  } catch {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) localStorage.setItem(CORRUPTED_BACKUP_KEY, raw);
    } catch {
      // Ignore secondary storage errors
    }
    return { data: [], corrupted: true };
  }
}

export function saveHistory(records: SpeedTestResult[]): boolean {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function appendTestRecord(record: SpeedTestResult): SpeedTestResult[] {
  const { data } = loadHistory();
  const next = [record, ...data.filter((item) => item.id !== record.id)].slice(0, 500);
  saveHistory(next);
  return next;
}

export function deleteTestRecord(id: string): SpeedTestResult[] {
  const { data } = loadHistory();
  const next = data.filter((item) => item.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistoryStorage(): boolean {
  try {
    localStorage.removeItem(HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const validStyles = ['cyber', 'aurora', 'matrix', 'warp', 'minimal', 'off'] as const;
    const rawStyle = parsed?.animationStyle;
    const resolvedStyle =
      typeof rawStyle === 'string' && (validStyles as readonly string[]).includes(rawStyle)
        ? rawStyle
        : parsed?.animationsEnabled === false
          ? 'off'
          : DEFAULT_SETTINGS.animationStyle;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      theme: 'dark',
      animationStyle: resolvedStyle,
      animationsEnabled: resolvedStyle !== 'off',
      alerts: {
        ...DEFAULT_SETTINGS.alerts,
        ...(parsed?.alerts ?? {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function exportBackupPayload(history: SpeedTestResult[], settings: AppSettings): string {
  return JSON.stringify(
    {
      product: 'NOVYRA Net',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings,
      history,
    },
    null,
    2,
  );
}

export function parseBackupPayload(rawJson: string): { history: SpeedTestResult[]; settings?: AppSettings } {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.history)) {
    throw new Error('Invalid NOVYRA Net backup format.');
  }
  const history = parsed.history.filter(
    (item: unknown): item is SpeedTestResult =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as SpeedTestResult).id === 'string' &&
          typeof (item as SpeedTestResult).downloadMbps === 'number' &&
          typeof (item as SpeedTestResult).uploadMbps === 'number' &&
          typeof (item as SpeedTestResult).timestamp === 'string',
      ),
  );
  return {
    history,
    settings: parsed.settings && typeof parsed.settings === 'object'
      ? {
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          theme: 'dark',
          animationStyle:
            typeof parsed.settings.animationStyle === 'string' &&
            ['cyber', 'aurora', 'matrix', 'warp', 'minimal', 'off'].includes(parsed.settings.animationStyle)
              ? parsed.settings.animationStyle
              : parsed.settings.animationsEnabled === false
                ? 'off'
                : DEFAULT_SETTINGS.animationStyle,
          animationsEnabled:
            parsed.settings.animationStyle === 'off'
              ? false
              : parsed.settings.animationsEnabled ?? true,
          alerts: { ...DEFAULT_SETTINGS.alerts, ...(parsed.settings.alerts ?? {}) },
        }
      : undefined,
  };
}
