import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';

export function isAiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY';
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      timeout: 45000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface NetworkAdviceInput {
  language: 'en' | 'ar';
  latestTest?: Record<string, unknown> | null;
  previousTest?: Record<string, unknown> | null;
  connectionInfo?: Record<string, unknown> | null;
  question?: string;
}

export async function generateNetworkAnalysis(input: NetworkAdviceInput): Promise<{ text: string; model: string }> {
  const ai = getClient();
  const langInstruction =
    input.language === 'ar'
      ? 'Respond entirely in clear, natural, modern Arabic (with technical terms like Mbps, ms, DNS, Ping kept accurate). Be concise, practical, and structured.'
      : 'Respond entirely in clear, concise, professional English. Be practical and structured.';

  const systemInstruction = [
    'You are NOVYRA AI Network Advisor, an expert network diagnostics engineer inside NOVYRA Net.',
    langInstruction,
    'Strict truthfulness rule: ONLY cite numbers and facts present in the provided telemetry JSON. Never invent IP addresses, packet loss numbers, or test results that are null or missing.',
    'If a metric is null or marked untested, explicitly acknowledge that it was not measured rather than guessing.',
    'Explain how bandwidth (Mbps), latency (ms), jitter (ms), and probe loss affect real activities like gaming, 4K streaming, video calls, and large uploads, and give concrete troubleshooting steps when metrics show degradation.',
  ].join(' ');

  const contextPayload = JSON.stringify(
    {
      latestTest: input.latestTest ?? null,
      previousTest: input.previousTest ?? null,
      connectionInfo: input.connectionInfo ?? null,
    },
    null,
    2,
  );

  const userPrompt = input.question?.trim()
    ? `User question: ${input.question.trim()}\n\nCurrent telemetry context:\n${contextPayload}`
    : `Analyze my current network telemetry and recent test comparison. Explain performance, bottlenecks (if any), and actionable recommendations.\n\nTelemetry:\n${contextPayload}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: userPrompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return {
    text: response.text ?? '',
    model: MODEL_NAME,
  };
}
