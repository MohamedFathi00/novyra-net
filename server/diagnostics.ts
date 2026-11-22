import { execFile } from 'node:child_process';
import dns from 'node:dns/promises';
import net from 'node:net';
import { promisify } from 'node:util';
import { isValidDomain, isValidPort, validateAndResolvePublicTarget } from './security.ts';

const execFileAsync = promisify(execFile);

export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS';

export interface DnsQueryResult {
  domain: string;
  durationMs: number;
  records: Partial<Record<DnsRecordType, unknown[]>>;
  errors: Partial<Record<DnsRecordType, string>>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function lookupDnsRecords(rawDomain: string, requestedTypes?: string[]): Promise<DnsQueryResult> {
  const domain = rawDomain.trim().replace(/^https?:\/\//i, '').split('/')[0].replace(/\.$/, '').toLowerCase();
  if (!isValidDomain(domain)) {
    throw new Error('Invalid domain name format.');
  }

  const allowed: DnsRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'];
  const types = (requestedTypes?.length
    ? requestedTypes.map((t) => t.toUpperCase()).filter((t): t is DnsRecordType => allowed.includes(t as DnsRecordType))
    : allowed);

  const startedAt = process.hrtime.bigint();
  const records: Partial<Record<DnsRecordType, unknown[]>> = {};
  const errors: Partial<Record<DnsRecordType, string>> = {};

  await Promise.all(
    types.map(async (type) => {
      try {
        switch (type) {
          case 'A':
            records.A = await withTimeout(dns.resolve4(domain, { ttl: true }), 5000, 'DNS A');
            break;
          case 'AAAA':
            records.AAAA = await withTimeout(dns.resolve6(domain, { ttl: true }), 5000, 'DNS AAAA');
            break;
          case 'MX':
            records.MX = await withTimeout(dns.resolveMx(domain), 5000, 'DNS MX');
            break;
          case 'TXT': {
            const rawTxt = await withTimeout(dns.resolveTxt(domain), 5000, 'DNS TXT');
            records.TXT = rawTxt.map((chunks) => chunks.join(''));
            break;
          }
          case 'CNAME':
            records.CNAME = await withTimeout(dns.resolveCname(domain), 5000, 'DNS CNAME');
            break;
          case 'NS':
            records.NS = await withTimeout(dns.resolveNs(domain), 5000, 'DNS NS');
            break;
        }
      } catch (err) {
        const code = err instanceof Error && 'code' in err ? String((err as NodeJS.ErrnoException).code) : undefined;
        errors[type] = code || (err instanceof Error ? err.message : 'Lookup failed');
      }
    }),
  );

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  return {
    domain,
    durationMs: Number(durationMs.toFixed(2)),
    records,
    errors,
  };
}

export interface TcpConnectProbe {
  seq: number;
  success: boolean;
  rttMs: number | null;
  error?: string;
}

function singleTcpConnect(ip: string, port: number, timeoutMs = 3500): Promise<{ success: boolean; rttMs: number | null; error?: string }> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const socket = net.createConnection({ host: ip, port });
    let settled = false;

    const finish = (result: { success: boolean; rttMs: number | null; error?: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const rttMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      finish({ success: true, rttMs: Number(rttMs.toFixed(2)) });
    });

    socket.on('timeout', () => {
      finish({ success: false, rttMs: null, error: 'ETIMEDOUT' });
    });

    socket.on('error', (err: NodeJS.ErrnoException) => {
      finish({ success: false, rttMs: null, error: err.code || err.message });
    });
  });
}

export async function runTcpPing(rawHost: string, port = 443, count = 4) {
  if (!isValidPort(port)) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }
  const clampedCount = Math.min(Math.max(Math.floor(count), 1), 10);
  const target = await validateAndResolvePublicTarget(rawHost);

  const attempts: TcpConnectProbe[] = [];
  for (let i = 1; i <= clampedCount; i++) {
    const res = await singleTcpConnect(target.resolvedIp, port, 3500);
    attempts.push({ seq: i, ...res });
  }

  const successful = attempts.filter((a) => a.success && a.rttMs !== null).map((a) => a.rttMs as number);
  const failures = attempts.length - successful.length;

  let jitterMs: number | null = null;
  if (successful.length >= 2) {
    let diffSum = 0;
    for (let i = 1; i < successful.length; i++) {
      diffSum += Math.abs(successful[i] - successful[i - 1]);
    }
    jitterMs = Number((diffSum / (successful.length - 1)).toFixed(2));
  }

  return {
    host: target.host,
    resolvedIp: target.resolvedIp,
    port,
    method: 'TCP Connect RTT',
    attempts,
    summary: {
      sent: attempts.length,
      succeeded: successful.length,
      failed: failures,
      lossPercent: Number(((failures / attempts.length) * 100).toFixed(1)),
      minMs: successful.length ? Math.min(...successful) : null,
      avgMs: successful.length ? Number((successful.reduce((a, b) => a + b, 0) / successful.length).toFixed(2)) : null,
      maxMs: successful.length ? Math.max(...successful) : null,
      jitterMs,
    },
  };
}

export async function checkPort(rawHost: string, port: number) {
  if (!isValidPort(port)) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }
  const target = await validateAndResolvePublicTarget(rawHost);
  const result = await singleTcpConnect(target.resolvedIp, port, 3500);

  let status: 'open' | 'closed' | 'timeout' = 'timeout';
  if (result.success) {
    status = 'open';
  } else if (result.error === 'ECONNREFUSED') {
    status = 'closed';
  } else {
    status = 'timeout';
  }

  return {
    host: target.host,
    resolvedIp: target.resolvedIp,
    port,
    status,
    rttMs: result.rttMs,
    detail: result.error ?? 'TCP handshake succeeded',
  };
}

export interface TracerouteCapability {
  available: boolean;
  command: string | null;
  reason: string;
}

export async function detectTracerouteCapability(): Promise<TracerouteCapability> {
  const candidates = ['traceroute', 'tracepath'];
  for (const cmd of candidates) {
    try {
      await execFileAsync('which', [cmd], { timeout: 1500 });
      return {
        available: true,
        command: cmd,
        reason: `System binary "${cmd}" detected on server host.`,
      };
    } catch {
      // Try next candidate
    }
  }
  return {
    available: false,
    command: null,
    reason: 'Native traceroute/tracepath requires raw ICMP/UDP socket privileges not present in this browser/sandbox container. Connect the NOVYRA Desktop Agent (Electron IPC bridge) or run on a privileged host.',
  };
}

export async function runTraceroute(rawHost: string) {
  const target = await validateAndResolvePublicTarget(rawHost);
  const cap = await detectTracerouteCapability();
  if (!cap.available || !cap.command) {
    return {
      supported: false,
      host: target.host,
      resolvedIp: target.resolvedIp,
      reason: cap.reason,
      hops: [],
    };
  }

  try {
    const args = cap.command === 'traceroute'
      ? ['-n', '-m', '12', '-w', '1', target.resolvedIp]
      : ['-n', '-m', '12', target.resolvedIp];
    const { stdout } = await execFileAsync(cap.command, args, { timeout: 15000 });
    const lines = stdout.split('\n').slice(1).filter((l) => l.trim().length > 0);
    const hops = lines.map((line, idx) => {
      const trimmed = line.trim();
      const hopMatch = trimmed.match(/^(\d+)\s+(.*)$/);
      const hopNumber = hopMatch ? Number(hopMatch[1]) : idx + 1;
      const body = hopMatch ? hopMatch[2] : trimmed;
      const ipMatch = body.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{3,})/);
      const rttMatches = [...body.matchAll(/(\d+(?:\.\d+)?)\s*ms/g)].map((m) => Number(m[1]));
      const timedOut = body.includes('* * *') && !ipMatch;
      return {
        hop: hopNumber,
        ip: ipMatch ? ipMatch[1] : null,
        hostname: null as string | null,
        rttMs: rttMatches.length ? Number((rttMatches.reduce((a, b) => a + b, 0) / rttMatches.length).toFixed(2)) : null,
        timedOut,
        raw: trimmed,
      };
    });

    return {
      supported: true,
      host: target.host,
      resolvedIp: target.resolvedIp,
      reason: `Executed via ${cap.command}`,
      hops,
    };
  } catch (err) {
    return {
      supported: false,
      host: target.host,
      resolvedIp: target.resolvedIp,
      reason: err instanceof Error ? err.message : 'Traceroute execution was blocked by host permissions.',
      hops: [],
    };
  }
}

export async function probeHttpsEndpoint(url: string): Promise<{ available: boolean; latencyMs: number | null; statusCode?: number; error?: string }> {
  const start = process.hrtime.bigint();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/dns-json' },
    });
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    return {
      available: res.ok || res.status < 500,
      latencyMs: Number(latencyMs.toFixed(1)),
      statusCode: res.status,
    };
  } catch (err) {
    return {
      available: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : 'Probe failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
