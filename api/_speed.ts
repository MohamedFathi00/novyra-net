import crypto from 'node:crypto';

export const randomChunk = crypto.randomBytes(64 * 1024);

export function noStore(res: any): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
  res.setHeader('Pragma', 'no-cache');
}

export function writeJson(res: any, status: number, body: unknown): void {
  noStore(res);
  res.status(status).json(body);
}

