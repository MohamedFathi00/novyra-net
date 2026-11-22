export const config = { api: { bodyParser: false } };

export default function handler(req: any, res: any): void {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const maxBytes = 16 * 1024 * 1024;
  const startedAt = process.hrtime.bigint();
  let bytesReceived = 0;
  let rejected = false;
  const chunks: Buffer[] = [];
  const timer = setTimeout(() => {
    if (!rejected && !res.headersSent) {
      rejected = true;
      req.destroy();
      res.status(408).json({ error: 'Upload probe timed out.' });
    }
  }, 20000);

  req.on('data', (chunk: Buffer) => {
    if (rejected) return;
    bytesReceived += chunk.length;
    if (bytesReceived > maxBytes) {
      rejected = true;
      clearTimeout(timer);
      req.destroy();
      if (!res.headersSent) res.status(413).json({ error: 'Upload chunk exceeds 16 MB safety cap.' });
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    clearTimeout(timer);
    if (rejected) return;
    const elapsedMs = Math.max(Number(process.hrtime.bigint() - startedAt) / 1_000_000, 1);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, bytesReceived, elapsedMs: Number(elapsedMs.toFixed(2)), mbps: Number(((bytesReceived * 8) / (elapsedMs / 1000) / 1_000_000).toFixed(2)) });
  });
  req.on('error', () => {
    clearTimeout(timer);
    if (!rejected && !res.headersSent) res.status(400).json({ error: 'Upload stream interrupted.' });
  });
}

