export default function handler(req: any, res: any): void {
  const requested = Number(req.query?.bytes) || 2 * 1024 * 1024;
  // Vercel serverless functions are more reliable with a bounded complete
  // response than with a long-lived res.write stream.
  const totalBytes = Math.min(Math.max(Math.floor(requested), 65536), 4 * 1024 * 1024);
  const payload = Buffer.alloc(totalBytes);
  for (let i = 0; i < payload.length; i += 1) payload[i] = (i * 131 + (i >> 3) * 17) & 0xff;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(totalBytes));
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(payload);
}

