export default function handler(req: any, res: any): void {
  const forwarded = req.headers?.['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || null;
  const observedIp = rawIp?.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ observedIp, protocol: req.headers?.['x-forwarded-proto'] || 'https', httpVersion: req.httpVersion || null, hostHeader: req.headers?.host || null, timestamp: new Date().toISOString() });
}

