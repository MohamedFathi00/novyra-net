import { noStore, randomChunk } from '../_speed';

export default function handler(req: any, res: any): void {
  const requested = Number(req.query?.bytes) || 2 * 1024 * 1024;
  const totalBytes = Math.min(Math.max(Math.floor(requested), 65536), 16 * 1024 * 1024);
  noStore(res);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(totalBytes));
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let remaining = totalBytes;
  let aborted = false;
  req.on('close', () => { aborted = true; });

  const writeNext = (): void => {
    if (aborted || remaining <= 0) {
      if (!res.writableEnded) res.end();
      return;
    }
    while (remaining > 0 && !aborted) {
      const size = Math.min(remaining, randomChunk.length);
      remaining -= size;
      if (!res.write(size === randomChunk.length ? randomChunk : randomChunk.subarray(0, size))) {
        res.once('drain', writeNext);
        return;
      }
    }
    if (!aborted && !res.writableEnded) res.end();
  };

  writeNext();
}

