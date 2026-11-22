export default function handler(req: any, res: any): void {
  const requested = Number(req.query?.bytes) || 2 * 1024 * 1024;
  const totalBytes = Math.min(Math.max(Math.floor(requested), 65536), 16 * 1024 * 1024);
  const randomChunk = Buffer.alloc(64 * 1024);
  for (let i = 0; i < randomChunk.length; i += 1) randomChunk[i] = (i * 131 + (i >> 3) * 17) & 0xff;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
  res.setHeader('Pragma', 'no-cache');
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

