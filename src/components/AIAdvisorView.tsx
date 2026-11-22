import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Crown, Send, Sparkles } from 'lucide-react';
import type { AiQuotaInfo, ConnectionInfo, Language, SpeedTestResult } from '../types/network';
import { getTranslations } from '../i18n/translations';
import { fetchAiStatus, requestAiAdvice } from '../services/aiAdvisorService';
import { useAuth } from '../context/AuthContext';
import { ErrorState } from './FeedbackUI';

interface AIAdvisorViewProps {
  language: Language;
  aiConfigured: boolean;
  latestTest: SpeedTestResult | null;
  previousTest: SpeedTestResult | null;
  connectionInfo: ConnectionInfo;
  onSummaryUpdated: (summary: string) => void;
  onUpgrade?: () => void;
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
}

export const AIAdvisorView: React.FC<AIAdvisorViewProps> = ({
  language,
  aiConfigured,
  latestTest,
  previousTest,
  connectionInfo,
  onSummaryUpdated,
  onUpgrade,
}) => {
  const t = getTranslations(language);
  const isAr = language === 'ar';
  const { user, entitlements, getIdToken } = useAuth();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [quota, setQuota] = useState<AiQuotaInfo | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getIdToken().catch(() => null);
      const status = await fetchAiStatus(token).catch(() => null);
      if (active && status?.quota) {
        setQuota(status.quota);
      }
    })();
    return () => {
      active = false;
    };
  }, [getIdToken, user?.uid, entitlements.planId]);

  const quotaExhausted = quota !== null && quota.remaining <= 0;

  const handleAnalyze = async (customPrompt?: string) => {
    setLoading(true);
    setError(null);

    if (customPrompt) {
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: customPrompt },
      ]);
    }

    try {
      const token = await getIdToken().catch(() => null);
      const res = await requestAiAdvice({
        language,
        latestTest,
        previousTest,
        connectionInfo,
        question: customPrompt,
        idToken: token,
      });
      if (res.quota) setQuota(res.quota);
      setMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, role: 'assistant', text: res.text, model: res.model },
      ]);
      if (!customPrompt && res.text) {
        onSummaryUpdated(res.text.slice(0, 220));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isAr
            ? 'تعذر الاتصال بمستشار NOVYRA الذكي.'
            : 'Unable to reach NOVYRA AI Advisor.',
      );
      const token = await getIdToken().catch(() => null);
      fetchAiStatus(token)
        .then((s) => s.quota && setQuota(s.quota))
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setQuestion('');
    handleAnalyze(trimmed);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#F4F7FF]">{t.aiPage.title}</h2>
          <p className="text-sm text-[#9EACC4] mt-0.5">{t.aiPage.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {quota && (
            <div className="rounded-xl border border-[#262a6b] bg-[#10134a]/70 px-3 py-1.5 text-xs font-mono-tabular">
              <span className="text-[#9aa0d6]">
                {isAr ? 'الحصة المتبقية اليوم:' : 'Daily Quota:'}{' '}
              </span>
              <span className="font-bold text-[#18c8ff]">
                {quota.remaining} / {quota.limit}
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={!aiConfigured || loading || quotaExhausted}
            onClick={() => handleAnalyze()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            <span>{loading ? t.aiPage.analyzing : t.aiPage.analyzeLatest}</span>
          </button>
        </div>
      </div>

      {/* Quota Exhausted Upgrade Banner */}
      {quotaExhausted && onUpgrade && (
        <div className="rounded-2xl border border-[#7a6bff]/50 bg-[#6555FF]/15 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Crown className="h-5 w-5 text-[#f5b942] shrink-0" />
            <span>
              {isAr
                ? `وصلت إلى الحد اليومي لتحليلات AI (${quota.limit}). قم بالترقية إلى Pro للحصول على 50 تحليلاً يومياً.`
                : `Daily AI Advisor quota reached (${quota.limit}). Upgrade to NOVYRA Pro for 50 analyses/day.`}
            </span>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-xl nv-btn-primary px-4 py-2 font-bold"
          >
            {isAr ? 'ترقية الباقة' : 'Upgrade Plan'}
          </button>
        </div>
      )}

      {/* Configuration Required State (Honest, no fake AI fallback) */}
      {!aiConfigured && (
        <div className="rounded-2xl border border-[#F5B942]/40 bg-[#F5B942]/10 p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[#F5B942] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-[#F4F7FF]">{t.aiPage.configRequiredTitle}</h3>
            <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">{t.aiPage.configRequiredBody}</p>
          </div>
        </div>
      )}

      {/* Telemetry Context Strip */}
      <div className="nv-card p-4 text-xs">
        {latestTest ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono-tabular">
            <span className="text-[#9EACC4] font-sans">
              {isAr
                ? `السياق النشط (${new Date(latestTest.timestamp).toLocaleString()}):`
                : `Active Context (${new Date(latestTest.timestamp).toLocaleString()}):`}
            </span>
            <span className="text-[#08C8F0] font-bold">↓ {latestTest.downloadMbps.toFixed(2)} Mbps</span>
            <span className="text-[#A855F7] font-bold">↑ {latestTest.uploadMbps.toFixed(2)} Mbps</span>
            <span>
              {isAr ? 'البنج' : 'Ping'} {latestTest.pingMs.toFixed(1)} ms
            </span>
            <span>
              {isAr ? 'التذبذب' : 'Jitter'} {latestTest.jitterMs.toFixed(1)} ms
            </span>
            <span>
              {isAr ? 'الفقدان' : 'Loss'}{' '}
              {latestTest.probeLossPercent !== null ? `${latestTest.probeLossPercent}%` : t.dashboard.untested}
            </span>
          </div>
        ) : (
          <span className="text-[#9EACC4]">{t.aiPage.noTestContext}</span>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="flex flex-wrap gap-2">
        {t.aiPage.suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={!aiConfigured || loading || quotaExhausted}
            onClick={() => handleAnalyze(prompt)}
            className="rounded-xl border border-[#263650] bg-[#121D32] px-3 py-2 text-xs text-[#F4F7FF] hover:border-[#08C8F0]/60 disabled:opacity-45 text-start"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error && (
        <ErrorState
          title={isAr ? 'خطأ في مستشار NOVYRA الذكي' : 'NOVYRA AI Error'}
          message={error}
        />
      )}

      {/* Conversation Transcript */}
      <div className="nv-card p-5 space-y-4 min-h-[260px]">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#9EACC4] flex flex-col items-center gap-2">
            <Bot className="h-8 w-8 text-[#08C8F0]/70" />
            <span>{aiConfigured ? t.dashboard.aiReady : t.aiPage.configRequiredTitle}</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#6555FF]/15 border border-[#6555FF]/35 text-[#F4F7FF] ms-auto max-w-2xl'
                  : 'bg-[#0E1628] border border-[#263650] text-[#F4F7FF]'
              }`}
            >
              {msg.text}
            </div>
          ))
        )}

        <form onSubmit={handleSubmit} className="pt-3 border-t border-[#263650] flex gap-2.5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!aiConfigured || loading || quotaExhausted}
            placeholder={t.aiPage.askPlaceholder}
            className="flex-1 rounded-xl border border-[#263650] bg-[#0E1628] px-4 py-2.5 text-sm text-[#F4F7FF] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!aiConfigured || loading || quotaExhausted || !question.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-45"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{t.aiPage.send}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
