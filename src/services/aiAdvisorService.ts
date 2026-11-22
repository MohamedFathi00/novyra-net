import type { AiQuotaInfo, ConnectionInfo, Language, SpeedTestResult } from '../types/network';

export interface AiStatusResponse {
  configured: boolean;
  model: string;
  quota?: AiQuotaInfo;
}

export async function fetchAiStatus(idToken?: string | null): Promise<AiStatusResponse> {
  const headers: Record<string, string> = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch('/api/ai/status', { headers });
  if (!res.ok) return { configured: false, model: 'gemini-4-hydrogen' };
  return res.json();
}

export async function requestAiAdvice(params: {
  language: Language;
  latestTest?: SpeedTestResult | null;
  previousTest?: SpeedTestResult | null;
  connectionInfo?: ConnectionInfo | null;
  question?: string;
  idToken?: string | null;
}): Promise<{ text: string; model: string; quota?: AiQuotaInfo }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.idToken) headers.Authorization = `Bearer ${params.idToken}`;

  const res = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language: params.language,
      latestTest: params.latestTest,
      previousTest: params.previousTest,
      connectionInfo: params.connectionInfo,
      question: params.question,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'AI analysis request failed.');
  }
  return data;
}
