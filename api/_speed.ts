// Keep the Vercel function dependency-free. The response is explicitly marked
// as identity encoded, so this deterministic binary buffer is not compressed
// by the platform and is suitable for throughput measurement.
export const randomChunk = Buffer.alloc(64 * 1024);
for (let i = 0; i < randomChunk.length; i += 1) {
  randomChunk[i] = (i * 131 + (i >> 3) * 17) & 0xff;
}

export function noStore(res: any): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
  res.setHeader('Pragma', 'no-cache');
}

export function writeJson(res: any, status: number, body: unknown): void {
  noStore(res);
  res.status(status).json(body);
}

