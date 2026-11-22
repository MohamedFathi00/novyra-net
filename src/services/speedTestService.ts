import type {
  AppSettings,
  ConnectionInfo,
  ServerNode,
  SpeedTestProgress,
  SpeedTestResult,
} from '../types/network';

export interface RunSpeedTestOptions {
  server: ServerNode;
  settings: AppSettings;
  connectionInfo: ConnectionInfo;
  signal: AbortSignal;
  onProgress: (progress: SpeedTestProgress) => void;
}

function calcJitter(rtts: number[]): number {
  if (rtts.length < 2) return 0;
  let totalDiff = 0;
  for (let i = 1; i < rtts.length; i++) {
    totalDiff += Math.abs(rtts[i] - rtts[i - 1]);
  }
  return Number((totalDiff / (rtts.length - 1)).toFixed(2));
}

async function singleHttpPing(signal: AbortSignal, timeoutMs = 3500): Promise<number | null> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const started = performance.now();
  try {
    const res = await fetch(`/api/speedtest/ping?t=${Date.now()}_${Math.random()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    await res.arrayBuffer();
    return Number((performance.now() - started).toFixed(2));
  } catch {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

export async function executeRealSpeedTest(options: RunSpeedTestOptions): Promise<SpeedTestResult> {
  const { server, settings, connectionInfo, signal, onProgress } = options;
  const startedTimestamp = performance.now();
  const maxPayloadBytes = settings.maxPayloadMb * 1024 * 1024;
  const phaseDurationMs = settings.testDurationSec * 1000;

  let progressState: SpeedTestProgress = {
    phase: 'ping',
    progressPercent: 2,
    currentSpeedMbps: 0,
    downloadMbps: null,
    uploadMbps: null,
    downloadSamples: [],
    uploadSamples: [],
    idlePingMs: null,
    minPingMs: null,
    maxPingMs: null,
    downloadLatencyMs: null,
    uploadLatencyMs: null,
    jitterMs: null,
    probeLossPercent: null,
    probeCount: 0,
  };

  const emit = (patch: Partial<SpeedTestProgress>) => {
    progressState = { ...progressState, ...patch };
    onProgress(progressState);
  };

  emit({});

  // PHASE 1: Idle Latency, Jitter, and HTTP Probe Loss (10 rapid probes)
  const TOTAL_PING_PROBES = 10;
  const pingRtts: number[] = [];
  let failedProbes = 0;

  for (let i = 0; i < TOTAL_PING_PROBES; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const rtt = await singleHttpPing(signal);
    if (rtt !== null) {
      pingRtts.push(rtt);
    } else {
      failedProbes += 1;
    }

    const avgPing = pingRtts.length
      ? Number((pingRtts.reduce((a, b) => a + b, 0) / pingRtts.length).toFixed(1))
      : null;

    emit({
      progressPercent: 4 + Math.round(((i + 1) / TOTAL_PING_PROBES) * 16),
      idlePingMs: avgPing,
      minPingMs: pingRtts.length ? Number(Math.min(...pingRtts).toFixed(1)) : null,
      maxPingMs: pingRtts.length ? Number(Math.max(...pingRtts).toFixed(1)) : null,
      jitterMs: pingRtts.length >= 2 ? calcJitter(pingRtts) : 0,
      probeLossPercent: Number(((failedProbes / (i + 1)) * 100).toFixed(1)),
      probeCount: i + 1,
    });
  }

  if (pingRtts.length === 0) {
    throw new Error('All latency probes failed. Check your connection to the NOVYRA Speed Engine.');
  }

  const idlePingAvg = Number((pingRtts.reduce((a, b) => a + b, 0) / pingRtts.length).toFixed(2));
  const minPing = Number(Math.min(...pingRtts).toFixed(2));
  const maxPing = Number(Math.max(...pingRtts).toFixed(2));
  const jitter = calcJitter(pingRtts);
  const probeLossPercent = Number(((failedProbes / TOTAL_PING_PROBES) * 100).toFixed(1));

  // PHASE 2: Download Throughput (2 parallel streams reading ReadableStream chunks)
  emit({ phase: 'download', currentSpeedMbps: 0, progressPercent: 22 });

  const dlStart = performance.now();
  let dlBytes = 0;
  const dlSamples: number[] = [];
  const loadedDlRtts: number[] = [];
  const dlTargetEnd = dlStart + Math.min(phaseDurationMs, 10000);
  const chunkSizeBytes = Math.min(4 * 1024 * 1024, Math.max(1024 * 1024, Math.floor(maxPayloadBytes / 4)));

  const dlTicker = setInterval(() => {
    const elapsedSec = Math.max((performance.now() - dlStart) / 1000, 0.05);
    const instantMbps = Number(((dlBytes * 8) / elapsedSec / 1_000_000).toFixed(2));
    dlSamples.push(instantMbps);
    const timeRatio = Math.min((performance.now() - dlStart) / Math.min(phaseDurationMs, 10000), 1);
    const byteRatio = Math.min(dlBytes / maxPayloadBytes, 1);
    const phaseProgress = Math.max(timeRatio, byteRatio);

    emit({
      currentSpeedMbps: instantMbps,
      downloadMbps: instantMbps,
      downloadSamples: dlSamples.slice(-28),
      progressPercent: 22 + Math.round(phaseProgress * 36),
    });
  }, 150);

  // Measure loaded latency mid-download
  const dlLatencyProbe = (async () => {
    await new Promise((r) => setTimeout(r, 450));
    if (!signal.aborted) {
      const rtt = await singleHttpPing(signal, 4000);
      if (rtt !== null) loadedDlRtts.push(rtt);
    }
  })();

  const runDownloadWorker = async () => {
    while (!signal.aborted && performance.now() < dlTargetEnd && dlBytes < maxPayloadBytes) {
      const res = await fetch(`/api/speedtest/download?bytes=${chunkSizeBytes}&r=${Math.random()}`, {
        cache: 'no-store',
        signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Download probe failed with status ${res.status}`);
      }
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) dlBytes += value.byteLength;
        if (signal.aborted || performance.now() >= dlTargetEnd || dlBytes >= maxPayloadBytes) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }
  };

  try {
    await Promise.all([runDownloadWorker(), runDownloadWorker(), dlLatencyProbe]);
  } finally {
    clearInterval(dlTicker);
  }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (dlBytes === 0) {
    throw new Error('Zero download bytes received from speed engine.');
  }

  const dlElapsedSec = Math.max((performance.now() - dlStart) / 1000, 0.1);
  const finalDownloadMbps = Number(((dlBytes * 8) / dlElapsedSec / 1_000_000).toFixed(2));
  const downloadLatencyMs = loadedDlRtts.length ? Number(loadedDlRtts[0].toFixed(2)) : null;

  emit({
    downloadMbps: finalDownloadMbps,
    currentSpeedMbps: 0,
    downloadLatencyMs,
    progressPercent: 60,
    phase: 'upload',
  });

  // PHASE 3: Upload Throughput (XHR for real upload progress events)
  const ulStart = performance.now();
  let ulBytesCompleted = 0;
  let ulBytesInFlight = 0;
  const ulSamples: number[] = [];
  const loadedUlRtts: number[] = [];
  const ulTargetEnd = ulStart + Math.min(phaseDurationMs, 10000);
  const uploadChunkSize = Math.min(2 * 1024 * 1024, Math.max(512 * 1024, Math.floor(maxPayloadBytes / 6)));

  // Build incompressible random payload chunk once (max 64KB crypto limit per call)
  const uploadBuffer = new Uint8Array(uploadChunkSize);
  for (let offset = 0; offset < uploadBuffer.length; offset += 65536) {
    const slice = uploadBuffer.subarray(offset, Math.min(offset + 65536, uploadBuffer.length));
    crypto.getRandomValues(slice);
  }

  const ulTicker = setInterval(() => {
    const totalUploaded = ulBytesCompleted + ulBytesInFlight;
    const elapsedSec = Math.max((performance.now() - ulStart) / 1000, 0.05);
    const instantMbps = Number(((totalUploaded * 8) / elapsedSec / 1_000_000).toFixed(2));
    ulSamples.push(instantMbps);
    const timeRatio = Math.min((performance.now() - ulStart) / Math.min(phaseDurationMs, 10000), 1);
    const byteRatio = Math.min(totalUploaded / maxPayloadBytes, 1);
    const phaseProgress = Math.max(timeRatio, byteRatio);

    emit({
      currentSpeedMbps: instantMbps,
      uploadMbps: instantMbps,
      uploadSamples: ulSamples.slice(-28),
      progressPercent: 60 + Math.round(phaseProgress * 38),
    });
  }, 150);

  const ulLatencyProbe = (async () => {
    await new Promise((r) => setTimeout(r, 450));
    if (!signal.aborted) {
      const rtt = await singleHttpPing(signal, 4000);
      if (rtt !== null) loadedUlRtts.push(rtt);
    }
  })();

  const sendSingleUpload = (): Promise<number> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/speedtest/upload?r=${Math.random()}`, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 18000;

      const onAbort = () => xhr.abort();
      signal.addEventListener('abort', onAbort, { once: true });

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          ulBytesInFlight = ev.loaded;
        }
      };

      xhr.onload = () => {
        signal.removeEventListener('abort', onAbort);
        ulBytesInFlight = 0;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(Number(parsed.bytesReceived) || uploadBuffer.byteLength);
          } catch {
            resolve(uploadBuffer.byteLength);
          }
        } else {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        signal.removeEventListener('abort', onAbort);
        ulBytesInFlight = 0;
        reject(new Error('Upload network error.'));
      };

      xhr.ontimeout = () => {
        signal.removeEventListener('abort', onAbort);
        ulBytesInFlight = 0;
        reject(new Error('Upload timed out.'));
      };

      xhr.onabort = () => {
        signal.removeEventListener('abort', onAbort);
        ulBytesInFlight = 0;
        reject(new DOMException('Aborted', 'AbortError'));
      };

      xhr.send(uploadBuffer);
    });

  try {
    await Promise.all([
      (async () => {
        while (!signal.aborted && performance.now() < ulTargetEnd && ulBytesCompleted < maxPayloadBytes) {
          const received = await sendSingleUpload();
          ulBytesCompleted += received;
        }
      })(),
      ulLatencyProbe,
    ]);
  } finally {
    clearInterval(ulTicker);
  }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (ulBytesCompleted === 0) {
    throw new Error('Zero upload bytes acknowledged by speed engine.');
  }

  const ulElapsedSec = Math.max((performance.now() - ulStart) / 1000, 0.1);
  const finalUploadMbps = Number(((ulBytesCompleted * 8) / ulElapsedSec / 1_000_000).toFixed(2));
  const uploadLatencyMs = loadedUlRtts.length ? Number(loadedUlRtts[0].toFixed(2)) : null;

  emit({
    phase: 'complete',
    progressPercent: 100,
    currentSpeedMbps: finalDownloadMbps,
    downloadMbps: finalDownloadMbps,
    uploadMbps: finalUploadMbps,
    downloadLatencyMs,
    uploadLatencyMs,
    idlePingMs: idlePingAvg,
    minPingMs: minPing,
    maxPingMs: maxPing,
    jitterMs: jitter,
    probeLossPercent,
  });

  const totalDurationSec = Number(((performance.now() - startedTimestamp) / 1000).toFixed(1));

  return {
    id: `nv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    downloadMbps: finalDownloadMbps,
    uploadMbps: finalUploadMbps,
    pingMs: idlePingAvg,
    minPingMs: minPing,
    maxPingMs: maxPing,
    downloadLatencyMs,
    uploadLatencyMs,
    jitterMs: jitter,
    probeLossPercent,
    latencyMethod: 'HTTP/TCP RTT',
    lossMethod: 'HTTP Probe Loss',
    serverId: server.id,
    serverName: server.name,
    serverLocation: server.location,
    connectionType: connectionInfo.connectionType,
    effectiveType: connectionInfo.effectiveType,
    publicIp: connectionInfo.publicIpv4 ?? connectionInfo.serverObservedIp,
    isp: connectionInfo.isp,
    status: 'completed',
    durationSec: totalDurationSec,
    bytesTransferred: dlBytes + ulBytesCompleted,
    downloadSamples: progressState.downloadSamples.slice(-40),
    uploadSamples: progressState.uploadSamples.slice(-40),
  };
}
