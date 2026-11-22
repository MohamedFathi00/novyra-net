import React, { useState } from 'react';
import { Globe, RefreshCw, Search } from 'lucide-react';
import type { DnsLookupResult, Language, ServerNode } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { lookupDns } from '../services/diagnosticsService';
import { ErrorState } from './FeedbackUI';

interface DnsToolsViewProps {
  language: Language;
  servers: ServerNode[];
  probingServers: boolean;
  onProbeServers: () => void;
}

export const DnsToolsView: React.FC<DnsToolsViewProps> = ({
  language,
  servers,
  probingServers,
  onProbeServers,
}) => {
  const t = getTranslations(language);
  const [domain, setDomain] = useState('google.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DnsLookupResult | null>(null);

  const dnsProviders = servers.filter((s) => !s.isPrimaryBenchmark);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await lookupDns(domain);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'ar'
            ? 'فشل استعلام DNS.'
            : 'DNS lookup failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F7FF]">
            {t.nav.dns}
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#9EACC4] mt-0.5">
            {t.diagnosticsPage.dnsDesc}
          </p>
        </div>

        <button
          type="button"
          onClick={onProbeServers}
          disabled={probingServers}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#263650] bg-white dark:bg-[#121D32] px-4 py-2 text-xs font-semibold text-[#069FC7] dark:text-[#08C8F0] hover:bg-slate-50 dark:hover:bg-[#192640]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${probingServers ? 'animate-spin' : ''}`} />
          <span>{probingServers ? t.speedtestPage.probing : t.speedtestPage.probeServers}</span>
        </button>
      </div>

      {/* Public Resolver Reachability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dnsProviders.map((prov) => (
          <div
            key={prov.id}
            className="nv-card p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#08C8F0]" />
                <span className="text-sm font-bold text-slate-900 dark:text-[#F4F7FF]">
                  {language === 'ar' ? prov.nameAr : prov.name}
                </span>
              </div>
              <span
                className={`text-xs font-mono-tabular font-bold ${
                  prov.status === 'online'
                    ? 'text-[#22C58B]'
                    : prov.status === 'unreachable'
                      ? 'text-[#F06478]'
                      : 'text-slate-400'
                }`}
              >
                {prov.latencyMs !== null
                  ? `${prov.latencyMs} ms`
                  : language === 'ar'
                    ? prov.status === 'online'
                      ? 'متصل'
                      : prov.status === 'unreachable'
                        ? 'غير متاح'
                        : 'غير مفحوص'
                    : prov.status}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-[#9EACC4]">
              {language === 'ar' ? prov.locationAr : prov.location}
            </div>
          </div>
        ))}
      </div>

      {/* Live DNS Query Console */}
      <section className="nv-card p-5 space-y-5">
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t.diagnosticsPage.domainPlaceholder}
              className="w-full rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] ps-10 pe-4 py-2.5 text-sm text-slate-900 dark:text-[#F4F7FF]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {loading ? t.diagnosticsPage.running : t.diagnosticsPage.run}
          </button>
        </form>

        {error && (
          <ErrorState
            title={language === 'ar' ? 'خطأ في استعلام DNS' : 'DNS Query Error'}
            message={error}
          />
        )}

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'] as const).map((type) => {
              const items = result.records[type];
              const errMsg = result.errors[type];
              return (
                <div
                  key={type}
                  className="rounded-xl border border-slate-200 dark:border-[#263650] bg-slate-50 dark:bg-[#0E1628] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-tabular text-xs font-bold text-[#069FC7] dark:text-[#08C8F0]">
                      {type}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono-tabular">
                      {items ? `${items.length}` : errMsg || '0'}
                    </span>
                  </div>
                  {items && items.length > 0 ? (
                    <div className="space-y-1 text-xs font-mono-tabular text-slate-800 dark:text-[#F4F7FF] break-all">
                      {items.map((item, idx) => (
                        <div key={idx}>{typeof item === 'string' ? item : JSON.stringify(item)}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">{errMsg || '—'}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
