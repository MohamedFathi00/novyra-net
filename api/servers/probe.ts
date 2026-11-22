import { servers } from './index';

export default async function handler(_req: any, res: any): Promise<void> {
  const results = await Promise.all(servers.map(async (server) => {
    if (server.host === 'self') return { ...server, status: 'online', latencyMs: 0, checkedAt: new Date().toISOString() };
    const started = performance.now();
    try {
      const response = await fetch(server.host, { signal: AbortSignal.timeout(4000) });
      return { ...server, status: response.ok ? 'online' : 'unreachable', latencyMs: Number((performance.now() - started).toFixed(1)), checkedAt: new Date().toISOString() };
    } catch (error) {
      return { ...server, status: 'unreachable', latencyMs: null, error: error instanceof Error ? error.message : 'Probe failed', checkedAt: new Date().toISOString() };
    }
  }));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ servers: results });
}

