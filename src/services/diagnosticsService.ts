import type {
  DnsLookupResult,
  PortCheckResult,
  ServerNode,
  TcpPingResult,
  TracerouteResult,
} from '../types/network';

export async function fetchConfiguredServers(): Promise<ServerNode[]> {
  const res = await fetch('/api/servers');
  if (!res.ok) throw new Error('Failed to load server list.');
  const data = await res.json();
  return (data.servers ?? []).map((s: Omit<ServerNode, 'status' | 'latencyMs'>) => ({
    ...s,
    status: s.isPrimaryBenchmark ? 'online' : 'unchecked',
    latencyMs: null,
  }));
}

export async function probeAllServers(): Promise<ServerNode[]> {
  const res = await fetch('/api/servers/probe', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to probe server availability.');
  const data = await res.json();
  return data.servers ?? [];
}

export async function lookupDns(domain: string, types?: string[]): Promise<DnsLookupResult> {
  const params = new URLSearchParams({ domain });
  if (types?.length) params.set('types', types.join(','));
  const res = await fetch(`/api/diagnostics/dns?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'DNS lookup failed.');
  return data;
}

export async function runTcpPingDiagnostic(host: string, port: number, count: number): Promise<TcpPingResult> {
  const res = await fetch('/api/diagnostics/tcp-ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, count }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'TCP ping failed.');
  return data;
}

export async function runPortCheckDiagnostic(host: string, port: number): Promise<PortCheckResult> {
  const res = await fetch('/api/diagnostics/port-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Port check failed.');
  return data;
}

export async function fetchTracerouteCapability(): Promise<{ available: boolean; command: string | null; reason: string }> {
  const res = await fetch('/api/diagnostics/traceroute-capability');
  if (!res.ok) throw new Error('Unable to check traceroute capability.');
  return res.json();
}

export async function runTracerouteDiagnostic(host: string): Promise<TracerouteResult> {
  const res = await fetch('/api/diagnostics/traceroute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Traceroute failed.');
  return data;
}
