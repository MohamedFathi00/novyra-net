const servers = [
  { id: 'novyra-core', name: 'NOVYRA Speed Engine (Active Node)', nameAr: 'محرك NOVYRA للسرعة (الخادم النشط)', location: 'Vercel Edge Function', locationAr: 'خادم NOVYRA السحابي', host: 'self', capabilities: ['download', 'upload', 'latency', 'probe-loss'], isPrimaryBenchmark: true },
  { id: 'cloudflare-dns', name: 'Cloudflare Anycast Edge', nameAr: 'عقدة Cloudflare العالمية', location: 'Global Anycast (1.1.1.1)', locationAr: 'شبكة Anycast العالمية', host: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A', capabilities: ['latency'], isPrimaryBenchmark: false },
  { id: 'google-dns', name: 'Google Public DNS Edge', nameAr: 'عقدة Google DNS العالمية', location: 'Global Anycast (8.8.8.8)', locationAr: 'شبكة Anycast العالمية', host: 'https://dns.google/resolve?name=example.com&type=A', capabilities: ['latency'], isPrimaryBenchmark: false },
];

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export default async function handler(_req: any, res: any): Promise<void> {
  const results = await Promise.all(servers.map(async (server) => {
    if (server.host === 'self') return { ...server, status: 'online', latencyMs: 0, checkedAt: new Date().toISOString() };
    const started = performance.now();
    try {
      const response = await fetch(server.host, { signal: withTimeout(4000) });
      return { ...server, status: response.ok ? 'online' : 'unreachable', latencyMs: Number((performance.now() - started).toFixed(1)), checkedAt: new Date().toISOString() };
    } catch (error) {
      return { ...server, status: 'unreachable', latencyMs: null, error: error instanceof Error ? error.message : 'Probe failed', checkedAt: new Date().toISOString() };
    }
  }));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ servers: results });
}

