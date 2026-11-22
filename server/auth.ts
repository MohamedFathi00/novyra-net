import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ADMIN_BOOTSTRAP_EMAIL = (
  process.env.ADMIN_BOOTSTRAP_EMAIL || 'me40351@gmail.com'
).toLowerCase();

export const ADMIN_BOOTSTRAP_EMAILS = new Set(
  [
    ...ADMIN_BOOTSTRAP_EMAIL.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
    'me40351@gmail.com',
  ],
);

function loadProjectId(): string | null {
  try {
    const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId && !parsed.projectId.includes('remixed')) {
      return parsed.projectId;
    }
  } catch {
    // Config missing or unreadable
  }
  return process.env.FIREBASE_PROJECT_ID || null;
}

function getFirebaseAdminApp(): App | null {
  const projectId = loadProjectId();
  if (!projectId) return null;
  return getApps().length ? getApp() : initializeApp({ projectId });
}

export interface VerifiedCaller {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
}

export async function verifyFirebaseBearerToken(req: Request): Promise<VerifiedCaller | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 8192) {
    return null;
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error('Firebase project configuration missing on server.');
  }

  const decoded = await getAuth(app).verifyIdToken(token);
  const email = typeof decoded.email === 'string' ? decoded.email.toLowerCase() : null;
  const emailVerified = decoded.email_verified === true;
  const isAdmin = Boolean(emailVerified && email && ADMIN_BOOTSTRAP_EMAILS.has(email));

  return {
    uid: decoded.uid,
    email,
    emailVerified,
    isAdmin,
  };
}

export function requireAuth(options: { requireVerified?: boolean; requireAdmin?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      if (!caller) {
        res.status(401).json({
          error: 'AUTH_REQUIRED',
          message: 'Valid Firebase authentication token is required.',
        });
        return;
      }
      if (options.requireVerified && !caller.emailVerified) {
        res.status(403).json({
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification is required to access this endpoint.',
        });
        return;
      }
      if (options.requireAdmin && !caller.isAdmin) {
        res.status(403).json({
          error: 'ADMIN_REQUIRED',
          message: 'Verified administrator privileges are required.',
        });
        return;
      }
      (req as Request & { caller?: VerifiedCaller }).caller = caller;
      next();
    } catch {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }
  };
}

export function createSlidingRateLimiter(params: { windowMs: number; maxRequests: number }) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - params.windowMs;
    const prev = (hits.get(key) ?? []).filter((ts) => ts > windowStart);

    if (prev.length >= params.maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait before trying again.',
      });
      return;
    }

    prev.push(now);
    hits.set(key, prev);

    // Opportunistic cleanup to keep map bounded
    if (hits.size > 5000) {
      for (const [k, timestamps] of hits.entries()) {
        if (!timestamps.some((ts) => ts > windowStart)) {
          hits.delete(k);
        }
      }
    }

    next();
  };
}
