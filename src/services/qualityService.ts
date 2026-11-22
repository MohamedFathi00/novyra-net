import type { ActivityRating, QualityAssessment, QualityCategoryAssessment } from '../types/network';

export interface QualityInput {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  probeLossPercent: number | null;
}

function scoreToRating(score: number): ActivityRating {
  if (score >= 85) return 'excellent';
  if (score >= 68) return 'good';
  if (score >= 45) return 'fair';
  return 'poor';
}

export function analyzeConnectionQuality(input: QualityInput | null): QualityAssessment {
  if (!input) {
    const emptyCategories: QualityCategoryAssessment[] = (
      ['browsing', 'gaming', 'videocalls', 'hdStreaming', 'uhdStreaming', 'largeDownloads'] as const
    ).map((id) => ({
      id,
      rating: 'insufficient',
      score: 0,
      reasons: ['Run a speed test to evaluate this workload.'],
      reasonsAr: ['أجرِ اختبار سرعة لتقييم ملاءمة الاتصال لهذا الاستخدام.'],
    }));

    return {
      overallRating: 'insufficient',
      overallScore: 0,
      categories: emptyCategories,
      thresholdsNote: 'Evaluated using documented bandwidth, RTT, jitter, and probe loss thresholds.',
    };
  }

  const { downloadMbps, uploadMbps, pingMs, jitterMs, probeLossPercent } = input;
  const loss = probeLossPercent ?? 0;

  // 1. General Browsing
  const browsingScore = Math.max(
    0,
    Math.min(
      100,
      (downloadMbps >= 25 ? 55 : downloadMbps >= 10 ? 42 : downloadMbps >= 3 ? 25 : 10) +
        (pingMs <= 40 ? 30 : pingMs <= 100 ? 22 : pingMs <= 180 ? 12 : 4) +
        (loss === 0 ? 15 : loss <= 2 ? 8 : 0),
    ),
  );

  // 2. Online Gaming (heavily sensitive to ping, jitter, and loss)
  const gamingScore = Math.max(
    0,
    Math.min(
      100,
      (pingMs <= 25 ? 40 : pingMs <= 50 ? 30 : pingMs <= 90 ? 18 : 5) +
        (jitterMs <= 5 ? 30 : jitterMs <= 15 ? 20 : jitterMs <= 30 ? 10 : 2) +
        (loss === 0 ? 20 : loss <= 1 ? 10 : 0) +
        (downloadMbps >= 15 && uploadMbps >= 5 ? 10 : 5),
    ),
  );

  // 3. Video Calls (depends strongly on upload, jitter, and latency)
  const videoCallScore = Math.max(
    0,
    Math.min(
      100,
      (uploadMbps >= 10 ? 35 : uploadMbps >= 4 ? 25 : uploadMbps >= 1.5 ? 15 : 4) +
        (downloadMbps >= 10 ? 25 : downloadMbps >= 4 ? 18 : 6) +
        (jitterMs <= 10 ? 25 : jitterMs <= 25 ? 15 : 5) +
        (pingMs <= 60 ? 15 : pingMs <= 120 ? 10 : 3) -
        (loss > 1 ? 15 : 0),
    ),
  );

  // 4. HD Streaming (1080p)
  const hdScore = Math.max(
    0,
    Math.min(
      100,
      (downloadMbps >= 15 ? 75 : downloadMbps >= 8 ? 58 : downloadMbps >= 5 ? 40 : 15) +
        (jitterMs <= 25 ? 15 : 8) +
        (loss === 0 ? 10 : 4),
    ),
  );

  // 5. 4K UHD Streaming
  const uhdScore = Math.max(
    0,
    Math.min(
      100,
      (downloadMbps >= 40 ? 75 : downloadMbps >= 25 ? 58 : downloadMbps >= 15 ? 35 : 10) +
        (jitterMs <= 20 ? 15 : 6) +
        (loss === 0 ? 10 : 2),
    ),
  );

  // 6. Large File Downloads
  const downloadWorkScore = Math.max(
    0,
    Math.min(
      100,
      (downloadMbps >= 150 ? 85 : downloadMbps >= 75 ? 72 : downloadMbps >= 35 ? 55 : downloadMbps >= 15 ? 35 : 15) +
        (loss === 0 ? 15 : 5),
    ),
  );

  const categories: QualityCategoryAssessment[] = [
    {
      id: 'browsing',
      rating: scoreToRating(browsingScore),
      score: Math.round(browsingScore),
      reasons: [
        `Download ${downloadMbps.toFixed(1)} Mbps with ${pingMs.toFixed(0)} ms RTT.`,
        loss > 0 ? `${loss}% probe loss detected.` : 'Zero probe loss recorded.',
      ],
      reasonsAr: [
        `سرعة التحميل ${downloadMbps.toFixed(1)} Mbps مع استجابة ${pingMs.toFixed(0)} ms.`,
        loss > 0 ? `تم رصد فقدان فحص بنسبة ${loss}%.` : 'لم يُرصد فقدان في نبضات الفحص.',
      ],
    },
    {
      id: 'gaming',
      rating: scoreToRating(gamingScore),
      score: Math.round(gamingScore),
      reasons: [
        `Latency is ${pingMs.toFixed(0)} ms and jitter is ${jitterMs.toFixed(1)} ms (low ping & jitter matter most).`,
        probeLossPercent === null
          ? 'Packet loss was not directly tested via UDP.'
          : `Probe loss measured at ${probeLossPercent}%.`,
      ],
      reasonsAr: [
        `زمن الاستجابة ${pingMs.toFixed(0)} ms والتذبذب ${jitterMs.toFixed(1)} ms (ثبات Ping أهم من السرعة القصوى).`,
        probeLossPercent === null
          ? 'لم يُختبر فقدان الحزم عبر UDP مباشرة.'
          : `نسبة فقدان الفحص ${probeLossPercent}%.`,
      ],
    },
    {
      id: 'videocalls',
      rating: scoreToRating(videoCallScore),
      score: Math.round(videoCallScore),
      reasons: [
        `Upload ${uploadMbps.toFixed(1)} Mbps & jitter ${jitterMs.toFixed(1)} ms govern camera/audio clarity.`,
      ],
      reasonsAr: [
        `سرعة الرفع ${uploadMbps.toFixed(1)} Mbps والتذبذب ${jitterMs.toFixed(1)} ms يحددان جودة الصوت والصورة.`,
      ],
    },
    {
      id: 'hdStreaming',
      rating: scoreToRating(hdScore),
      score: Math.round(hdScore),
      reasons: [`Requires >= 5-8 Mbps sustained; measured ${downloadMbps.toFixed(1)} Mbps.`],
      reasonsAr: [`يتطلب البث عالي الدقة 5-8 Mbps مستقرة؛ القياس الحالي ${downloadMbps.toFixed(1)} Mbps.`],
    },
    {
      id: 'uhdStreaming',
      rating: scoreToRating(uhdScore),
      score: Math.round(uhdScore),
      reasons: [`Requires >= 25 Mbps sustained for 4K buffer-free playback; measured ${downloadMbps.toFixed(1)} Mbps.`],
      reasonsAr: [`يتطلب بث 4K سرعة >= 25 Mbps مستقرة؛ القياس الحالي ${downloadMbps.toFixed(1)} Mbps.`],
    },
    {
      id: 'largeDownloads',
      rating: scoreToRating(downloadWorkScore),
      score: Math.round(downloadWorkScore),
      reasons: [`Sustained download throughput measured at ${downloadMbps.toFixed(1)} Mbps.`],
      reasonsAr: [`بلغت سرعة التحميل المستمرة ${downloadMbps.toFixed(1)} Mbps.`],
    },
  ];

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  );

  return {
    overallRating: scoreToRating(overallScore),
    overallScore,
    categories,
    thresholdsNote:
      'Ratings weigh latency, jitter, probe loss, upload, and download together (Gaming: RTT <= 50ms & jitter <= 15ms; 4K: >= 25 Mbps; Video Calls: upload >= 4 Mbps & jitter <= 25ms).',
  };
}
