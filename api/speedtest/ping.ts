import { noStore } from '../_speed';

export default function handler(_req: any, res: any): void {
  noStore(res);
  res.json({ ok: true, serverTimeMs: Date.now(), hrTimeNs: process.hrtime.bigint().toString() });
}

