import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  Feather,
  Network,
  PauseCircle,
  Rocket,
  RotateCcw,
  Trash2,
  Upload,
  Waves,
  Zap,
} from 'lucide-react';
import type { AccentTheme, AnimationStyle, AppSettings, Language, SpeedTestResult } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { DEFAULT_SETTINGS, parseBackupPayload } from '../services/storageService';
import { exportBackupAsJson } from '../services/exportService';
import { ConfirmationDialog } from './FeedbackUI';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  history: SpeedTestResult[];
  onImportBackup: (history: SpeedTestResult[], settings?: AppSettings) => void;
  onClearHistory: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  history,
  onImportBackup,
  onClearHistory,
  onNotify,
}) => {
  const t = getTranslations(settings.language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    onUpdateSettings({ ...settings, ...patch });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackupPayload(text);
      onImportBackup(parsed.history, parsed.settings);
      onNotify('success', t.settingsPage.importSuccess);
    } catch {
      onNotify('error', t.settingsPage.importError);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F7FF]">
          {t.settingsPage.title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-[#9EACC4] mt-0.5">
          {t.settingsPage.subtitle}
        </p>
      </div>

      {/* Appearance & Language */}
      <section className="nv-card p-5 space-y-4">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
          {t.settingsPage.appearance} &amp; {t.settingsPage.languageSection}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#9aa0d6] mb-1.5">
              {t.settingsPage.languageLabel}
            </label>
            <select
              value={settings.language}
              onChange={(e) => update({ language: e.target.value as Language })}
              className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
            >
              <option value="en">English (LTR)</option>
              <option value="ar">العربية (RTL)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#9aa0d6] mb-1.5">
              {t.settingsPage.accentColor}
            </label>
            <select
              value={settings.accent}
              onChange={(e) => update({ accent: e.target.value as AccentTheme })}
              className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
            >
              <option value="electric">
                {settings.language === 'ar' ? 'بنفسجي نيوني (#6555FF)' : 'Electric Violet (#6555FF)'}
              </option>
              <option value="cyan">
                {settings.language === 'ar' ? 'سماوي ساطع (#08C8F0)' : 'Neon Cyan (#08C8F0)'}
              </option>
              <option value="emerald">
                {settings.language === 'ar' ? 'زمردي (#22C58B)' : 'Emerald Telemetry (#22C58B)'}
              </option>
            </select>
          </div>
        </div>

        {/* Multi-Preset Smooth Animations Selector */}
        <div className="pt-2 border-t border-[#262a6b]/70">
          <div className="text-xs font-semibold text-[#cfd3ff] mb-2.5">
            {t.settingsPage.animationStyleLabel}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(
              [
                { id: 'cyber', Icon: Network, accent: 'from-[#18c8ff]/20 to-[#5b3df5]/20 text-[#18c8ff]' },
                { id: 'aurora', Icon: Waves, accent: 'from-[#22e06b]/20 to-[#a855f7]/20 text-[#22e06b]' },
                { id: 'matrix', Icon: Zap, accent: 'from-[#18c8ff]/20 to-[#22e06b]/20 text-[#38bdf8]' },
                { id: 'warp', Icon: Rocket, accent: 'from-[#a855f7]/20 to-[#4f46e5]/20 text-[#a855f7]' },
                { id: 'minimal', Icon: Feather, accent: 'from-[#6366f1]/20 to-[#18c8ff]/15 text-[#93c5fd]' },
                { id: 'off', Icon: PauseCircle, accent: 'from-slate-600/20 to-slate-800/20 text-[#9aa0d6]' },
              ] as Array<{ id: AnimationStyle; Icon: React.ComponentType<{ className?: string }>; accent: string }>
            ).map(({ id, Icon, accent }) => {
              const selected = settings.animationStyle === id;
              const info = t.settingsPage.animationStyles[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    update({
                      animationStyle: id,
                      animationsEnabled: id !== 'off',
                    })
                  }
                  className={`group relative flex items-start gap-3 rounded-xl border p-3 text-start transition-all cursor-pointer ${
                    selected
                      ? 'border-[#18c8ff] bg-gradient-to-br from-[#18c8ff]/12 via-[#10134a] to-[#5b3df5]/18 shadow-[0_0_16px_rgba(24,200,255,0.22)]'
                      : 'border-[#262a6b] bg-[#0a0d33]/90 hover:border-[#5b3df5] hover:bg-[#10134a]/80'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} border border-white/10`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-[#eef0ff] truncate">
                        {info.name}
                      </span>
                      {selected && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#18c8ff] text-[#080a24]">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#9aa0d6]">
                      {info.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testing Preferences */}
      <section className="nv-card p-5 space-y-4">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
          {t.settingsPage.testingPrefs}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-[#9EACC4] mb-1.5">
              {t.settingsPage.testDuration}
            </label>
            <select
              value={settings.testDurationSec}
              onChange={(e) => update({ testDurationSec: Number(e.target.value) as 5 | 10 | 15 })}
              className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 text-slate-900 dark:text-[#F4F7FF]"
            >
              <option value={5}>5 {t.common.seconds}</option>
              <option value={10}>10 {t.common.seconds}</option>
              <option value={15}>15 {t.common.seconds}</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-[#9EACC4] mb-1.5">
              {t.settingsPage.maxPayload}
            </label>
            <select
              value={settings.maxPayloadMb}
              onChange={(e) => update({ maxPayloadMb: Number(e.target.value) as 8 | 16 | 32 })}
              className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 text-slate-900 dark:text-[#F4F7FF]"
            >
              <option value={8}>8 {t.common.mb}</option>
              <option value={16}>16 {t.common.mb}</option>
              <option value={32}>32 {t.common.mb}</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-[#9EACC4] mb-1.5">
              {t.settingsPage.monitoringInterval}
            </label>
            <select
              value={settings.monitoringIntervalSec}
              onChange={(e) => update({ monitoringIntervalSec: Number(e.target.value) as 3 | 5 | 10 })}
              className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 text-slate-900 dark:text-[#F4F7FF]"
            >
              <option value={3}>3 {t.common.seconds}</option>
              <option value={5}>5 {t.common.seconds}</option>
              <option value={10}>10 {t.common.seconds}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2.5 cursor-pointer">
            <span>{t.settingsPage.autoSave}</span>
            <input
              type="checkbox"
              checked={settings.autoSaveHistory}
              onChange={(e) => update({ autoSaveHistory: e.target.checked })}
              className="h-4 w-4 accent-[#6555FF]"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2.5 cursor-pointer">
            <span>{t.settingsPage.publicIpLookup}</span>
            <input
              type="checkbox"
              checked={settings.enablePublicIpLookup}
              onChange={(e) => update({ enablePublicIpLookup: e.target.checked })}
              className="h-4 w-4 accent-[#6555FF]"
            />
          </label>
        </div>
      </section>

      {/* Alerts & Thresholds */}
      <section className="nv-card p-5 space-y-4">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
          {t.settingsPage.notificationsSection}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3.5 py-2.5 cursor-pointer">
            <span>{t.settingsPage.alertDisconnect}</span>
            <input
              type="checkbox"
              checked={settings.alerts.onDisconnect}
              onChange={(e) =>
                update({ alerts: { ...settings.alerts, onDisconnect: e.target.checked } })
              }
              className="h-4 w-4 accent-[#6555FF]"
            />
          </label>
          <div>
            <label className="block text-slate-500 mb-1">{t.settingsPage.lowDownloadLabel}</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={settings.alerts.lowDownloadThresholdMbps}
              onChange={(e) =>
                update({
                  alerts: { ...settings.alerts, lowDownloadThresholdMbps: Number(e.target.value) || 1 },
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">{t.settingsPage.highLatencyLabel}</label>
            <input
              type="number"
              min={10}
              max={2000}
              value={settings.alerts.highLatencyThresholdMs}
              onChange={(e) =>
                update({
                  alerts: { ...settings.alerts, highLatencyThresholdMs: Number(e.target.value) || 50 },
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-3 py-2 font-mono-tabular"
            />
          </div>
        </div>
      </section>

      {/* Data & Backup Management */}
      <section className="nv-card p-5 space-y-4">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
          {t.settingsPage.dataManagement}
        </h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <button
            type="button"
            onClick={() => exportBackupAsJson(history, settings)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-4 py-2.5 font-semibold hover:border-[#08C8F0]"
          >
            <Download className="h-4 w-4 text-[#08C8F0]" />
            <span>{t.settingsPage.exportBackup}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-4 py-2.5 font-semibold hover:border-[#6555FF]"
          >
            <Upload className="h-4 w-4 text-[#A855F7]" />
            <span>{t.settingsPage.importBackup}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              onUpdateSettings(DEFAULT_SETTINGS);
              onNotify('info', t.settingsPage.savedToast);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] px-4 py-2.5 font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t.settingsPage.restoreDefaults}</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 rounded-xl border border-[#DF475E]/30 bg-[#DF475E]/10 px-4 py-2.5 font-semibold text-[#DF475E] dark:text-[#F06478]"
          >
            <Trash2 className="h-4 w-4" />
            <span>{t.settingsPage.clearAllData}</span>
          </button>
        </div>
      </section>

      <ConfirmationDialog
        open={confirmClear}
        title={t.historyPage.confirmClearTitle}
        description={t.historyPage.confirmClearDesc}
        confirmLabel={t.historyPage.confirm}
        cancelLabel={t.historyPage.cancel}
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          onClearHistory();
          setConfirmClear(false);
        }}
      />
    </div>
  );
};
