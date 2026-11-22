export default function handler(_req: any, res: any): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({ ok: true, serverTimeMs: Date.now(), hrTimeNs: process.hrtime.bigint().toString() });
}

