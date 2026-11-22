import React, { useMemo, useState } from 'react';
import {
  Download,
  GitCompare,
  History,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import type { Language, SpeedTestResult } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { ConfirmationDialog, EmptyState } from './FeedbackUI';
import { exportHistoryAsCsv, exportBackupAsJson, printNetworkReport } from '../services/exportService';
import type { AppSettings } from '../types/network';

interface TestHistoryViewProps {
  language: Language;
  history: SpeedTestResult[];
  settings: AppSettings;
  maxHistoryRecords?: number;
  onUpgrade?: () => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onCompareSelected: (idA: string, idB: string) => void;
  onStartTest: () => void;
}

export const TestHistoryView: React.FC<TestHistoryViewProps> = ({
  language,
  history,
  settings,
  maxHistoryRecords = -1,
  onUpgrade,
  onDeleteRecord,
  onClearAll,
  onCompareSelected,
  onStartTest,
}) => {
  const t = getTranslations(language);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'download' | 'ping'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateFilter === '24h'
        ? now - 86_400_000
        : dateFilter === '7d'
          ? now - 7 * 86_400_000
          : dateFilter === '30d'
            ? now - 30 * 86_400_000
            : 0;

    const q = search.trim().toLowerCase();

    const sourceHistory =
      maxHistoryRecords === -1 ? history : history.slice(0, maxHistoryRecords);

    return [...sourceHistory]
      .filter((item) => {
        if (cutoff && new Date(item.timestamp).getTime() < cutoff) return false;
        if (!q) return true;
        return (
          item.serverName.toLowerCase().includes(q) ||
          (item.publicIp ?? '').toLowerCase().includes(q) ||
          (item.isp ?? '').toLowerCase().includes(q) ||
          (item.connectionType ?? item.effectiveType ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'download') return b.downloadMbps - a.downloadMbps;
        if (sortBy === 'ping') return a.pingMs - b.pingMs;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [history, maxHistoryRecords, search, dateFilter, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#F4F7FF]">
            {t.historyPage.title}
          </h2>
          <p className="text-sm text-[#9EACC4] mt-0.5">
            {t.historyPage.subtitle}
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 no-print">
            {selectedIds.length === 2 && (
              <button
                type="button"
                onClick={() => onCompareSelected(selectedIds[0], selectedIds[1])}
                className="flex items-center gap-1.5 rounded-xl bg-[#6555FF] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95"
              >
                <GitCompare className="h-3.5 w-3.5" />
                <span>{t.historyPage.compareSelected}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => exportHistoryAsCsv(filtered)}
              className="flex items-center gap-1.5 rounded-xl border border-[#263650] bg-[#121D32] px-3 py-2 text-xs font-medium text-[#F4F7FF] hover:bg-[#192640]"
            >
              <Download className="h-3.5 w-3.5 text-[#08C8F0]" />
              <span>{t.historyPage.exportCsv}</span>
            </button>
            <button
              type="button"
              onClick={() => exportBackupAsJson(history, settings)}
              className="flex items-center gap-1.5 rounded-xl border border-[#263650] bg-[#121D32] px-3 py-2 text-xs font-medium text-[#F4F7FF] hover:bg-[#192640]"
            >
              <Download className="h-3.5 w-3.5 text-[#A855F7]" />
              <span>{t.historyPage.exportJson}</span>
            </button>
            <button
              type="button"
              onClick={printNetworkReport}
              className="flex items-center gap-1.5 rounded-xl border border-[#263650] bg-[#121D32] px-3 py-2 text-xs font-medium text-[#F4F7FF] hover:bg-[#192640]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{t.historyPage.printReport}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#DF475E]/30 bg-[#DF475E]/10 px-3 py-2 text-xs font-semibold text-[#F06478] hover:bg-[#DF475E]/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t.historyPage.clearHistory}</span>
            </button>
          </div>
        )}
      </div>

      {maxHistoryRecords !== -1 && history.length > maxHistoryRecords && (
        <div className="nv-card p-3.5 border-[#6555FF]/35 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-[#b4c2e0]">
            {language === 'ar'
              ? `يعرض سجل الخطة المجانية أحدث ${maxHistoryRecords} اختباراً للمزامنة السحابية (تم الحفاظ على كل اختباراتك المحلية البالغ عددها ${history.length} بأمان).`
              : `Free plan displays the latest ${maxHistoryRecords} synced records (all ${history.length} local tests remain safely preserved).`}
          </div>
          {onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="rounded-xl nv-btn-primary px-3.5 py-1.5 text-xs font-bold"
            >
              {language === 'ar' ? 'ترقية للسجل غير المحدود' : 'Upgrade for Unlimited History'}
            </button>
          )}
        </div>
      )}

      {history.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title={t.historyPage.emptyTitle}
          description={t.historyPage.emptyDesc}
          actionLabel={t.historyPage.runFirstTest}
          onAction={onStartTest}
        />
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row gap-3 nv-card p-3.5 no-print">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-[#9EACC4] absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.historyPage.searchPlaceholder}
                className="w-full rounded-xl border border-[#263650] bg-[#0E1628] ps-9 pe-3 py-2 text-xs text-[#F4F7FF]"
              />
            </div>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | '24h' | '7d' | '30d')}
              className="rounded-xl border border-[#263650] bg-[#0E1628] px-3 py-2 text-xs text-[#F4F7FF]"
            >
              <option value="all">{t.historyPage.dateAll}</option>
              <option value="24h">{t.historyPage.dateToday}</option>
              <option value="7d">{t.historyPage.dateWeek}</option>
              <option value="30d">{t.historyPage.dateMonth}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'download' | 'ping')}
              className="rounded-xl border border-[#263650] bg-[#0E1628] px-3 py-2 text-xs text-[#F4F7FF]"
            >
              <option value="newest">{t.historyPage.sortNewest}</option>
              <option value="download">{t.historyPage.sortFastest}</option>
              <option value="ping">{t.historyPage.sortLowestPing}</option>
            </select>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto nv-card">
            <table className="w-full text-xs">
              <thead className="bg-[#0E1628] text-[#9EACC4] border-b border-[#263650]">
                <tr>
                  <th className="px-3 py-3 text-start w-10 no-print" />
                  <th className="px-3 py-3 text-start font-semibold">{t.common.date}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.common.server}</th>
                  <th className="px-3 py-3 text-end font-semibold">{t.dashboard.downloadSpeed}</th>
                  <th className="px-3 py-3 text-end font-semibold">{t.dashboard.uploadSpeed}</th>
                  <th className="px-3 py-3 text-end font-semibold">{language === 'ar' ? 'الاستجابة (Ping)' : 'Ping'}</th>
                  <th className="px-3 py-3 text-end font-semibold">{language === 'ar' ? 'التذبذب (Jitter)' : 'Jitter'}</th>
                  <th className="px-3 py-3 text-end font-semibold">{t.dashboard.packetLossLabel}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.dashboard.networkType}</th>
                  <th className="px-3 py-3 text-end font-semibold no-print">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263650]/70">
                {filtered.map((rec) => {
                  const checked = selectedIds.includes(rec.id);
                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-[#192640]/40 transition-colors"
                    >
                      <td className="px-3 py-3 no-print">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(rec.id)}
                          aria-label={`Select test ${rec.id}`}
                          className="h-3.5 w-3.5 accent-[#6555FF]"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono-tabular whitespace-nowrap text-[#F4F7FF]">
                        {new Date(rec.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 max-w-[200px] truncate text-[#F4F7FF]">
                        {rec.serverName}
                      </td>
                      <td className="px-3 py-3 text-end font-mono-tabular font-bold text-[#08C8F0]">
                        {rec.downloadMbps.toFixed(2)} Mbps
                      </td>
                      <td className="px-3 py-3 text-end font-mono-tabular font-bold text-[#A855F7]">
                        {rec.uploadMbps.toFixed(2)} Mbps
                      </td>
                      <td className="px-3 py-3 text-end font-mono-tabular">
                        {rec.pingMs.toFixed(1)} ms
                      </td>
                      <td className="px-3 py-3 text-end font-mono-tabular">
                        {rec.jitterMs.toFixed(1)} ms
                      </td>
                      <td className="px-3 py-3 text-end font-mono-tabular">
                        {rec.probeLossPercent !== null ? `${rec.probeLossPercent}%` : t.dashboard.untested}
                      </td>
                      <td className="px-3 py-3 uppercase text-[#9EACC4]">
                        {rec.connectionType || rec.effectiveType || '—'}
                      </td>
                      <td className="px-3 py-3 text-end no-print">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(rec.id)}
                          aria-label="Delete test record"
                          className="p-1 text-[#9EACC4] hover:text-[#DF475E] transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmationDialog
        open={pendingDeleteId !== null}
        title={t.historyPage.confirmDeleteTitle}
        description={t.historyPage.confirmDeleteDesc}
        confirmLabel={t.historyPage.confirm}
        cancelLabel={t.historyPage.cancel}
        destructive
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onDeleteRecord(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />

      <ConfirmationDialog
        open={confirmClearOpen}
        title={t.historyPage.confirmClearTitle}
        description={t.historyPage.confirmClearDesc}
        confirmLabel={t.historyPage.confirm}
        cancelLabel={t.historyPage.cancel}
        destructive
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          onClearAll();
          setConfirmClearOpen(false);
        }}
      />
    </div>
  );
};
