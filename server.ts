import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { generateNetworkAnalysis, isAiConfigured } from './server/ai.ts';
import {
  createSlidingRateLimiter,
  requireAuth,
  verifyFirebaseBearerToken,
  type VerifiedCaller,
} from './server/auth.ts';
import {
  createStripeCheckoutSession,
  getAdminSystemStatus,
  getPublicBillingSummary,
  markWebhookEventIfNew,
  verifyStripeCheckoutSession,
  verifyStripeWebhookSignature,
} from './server/billing.ts';
import {
  checkAndConsumeAiQuota,
  getAiQuotaStatus,
  getVerifiedUserSubscription,
  setVerifiedUserPlan,
} from './server/entitlements.ts';
import {
  checkPort,
  detectTracerouteCapability,
  lookupDnsRecords,
  probeHttpsEndpoint,
  runTcpPing,
  runTraceroute,
} from './server/diagnostics.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3000 is commonly occupied by other local dev servers. Use a quieter default
// for NOVYRA so `npm run dev` opens reliably on a developer machine; PORT still
// overrides it for hosted deployments.
const REQUESTED_PORT = Number(process.env.PORT) || 4173;
const HAS_EXPLICIT_PORT = Boolean(process.env.PORT);
const IS_PROD = process.env.NODE_ENV === 'production';

// Pre-generate 64KB of incompressible random bytes once for speed test download streaming
const RANDOM_CHUNK = crypto.randomBytes(65536);

const CONFIGURED_SERVERS = [
  {
    id: 'novyra-core',
    name: 'NOVYRA Speed Engine (Active Node)',
    nameAr: 'محرك NOVYRA للسرعة (الخادم النشط)',
    location: 'Application Host Region',
    locationAr: 'منطقة خادم التطبيق',
    host: 'self',
    capabilities: ['download', 'upload', 'latency', 'probe-loss'],
    isPrimaryBenchmark: true,
  },
  {
    id: 'cloudflare-dns',
    name: 'Cloudflare Anycast Edge',
    nameAr: 'عقدة Cloudflare العالمية',
    location: 'Global Anycast (1.1.1.1)',
    locationAr: 'شبكة Anycast العالمية',
    host: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
    capabilities: ['latency'],
    isPrimaryBenchmark: false,
  },
  {
    id: 'google-dns',
    name: 'Google Public DNS Edge',
    nameAr: 'عقدة Google DNS العالمية',
    location: 'Global Anycast (8.8.8.8)',
    locationAr: 'شبكة Anycast العالمية',
    host: 'https://dns.google/resolve?name=example.com&type=A',
    capabilities: ['latency'],
    isPrimaryBenchmark: false,
  },
  {
    id: 'quad9-dns',
    name: 'Quad9 Security Edge',
    nameAr: 'عقدة Quad9 الأمنية',
    location: 'Global Anycast (9.9.9.9)',
    locationAr: 'شبكة Anycast العالمية',
    host: 'https://dns.quad9.net:5053/dns-query?name=example.com&type=A',
    capabilities: ['latency'],
    isPrimaryBenchmark: false,
  },
];

async function createApp() {
  const app = express();
  app.set('trust proxy', true);

  // Speed test endpoints BEFORE express.json so raw binary uploads aren't parsed as JSON
  app.get('/api/speedtest/ping', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json({
      ok: true,
      serverTimeMs: Date.now(),
      hrTimeNs: process.hrtime.bigint().toString(),
    });
  });

  app.get('/api/speedtest/download', (req, res) => {
    const requested = Number(req.query.bytes) || 2 * 1024 * 1024;
    const totalBytes = Math.min(Math.max(Math.floor(requested), 65536), 16 * 1024 * 1024);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(totalBytes));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    let remaining = totalBytes;
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    const writeNext = () => {
      if (aborted || remaining <= 0) {
        if (!res.writableEnded) res.end();
        return;
      }
      while (remaining > 0 && !aborted) {
        const size = Math.min(remaining, RANDOM_CHUNK.length);
        const slice = size === RANDOM_CHUNK.length ? RANDOM_CHUNK : RANDOM_CHUNK.subarray(0, size);
        remaining -= size;
        const canContinue = res.write(slice);
        if (!canContinue) {
          res.once('drain', writeNext);
          return;
        }
      }
      if (!aborted && !res.writableEnded) {
        res.end();
      }
    };

    writeNext();
  });

  app.post('/api/speedtest/upload', (req, res) => {
    const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
    const startedAt = process.hrtime.bigint();
    let bytesReceived = 0;
    let rejected = false;

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
      if (bytesReceived > MAX_UPLOAD_BYTES) {
        rejected = true;
        clearTimeout(timer);
        req.destroy();
        if (!res.headersSent) {
          res.status(413).json({ error: 'Upload chunk exceeds 16 MB safety cap.' });
        }
      }
    });

    req.on('end', () => {
      clearTimeout(timer);
      if (rejected) return;
      const elapsedMs = Math.max(Number(process.hrtime.bigint() - startedAt) / 1_000_000, 1);
      const mbps = (bytesReceived * 8) / (elapsedMs / 1000) / 1_000_000;
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        bytesReceived,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        mbps: Number(mbps.toFixed(2)),
      });
    });

    req.on('error', () => {
      clearTimeout(timer);
      if (!rejected && !res.headersSent) {
        res.status(400).json({ error: 'Upload stream interrupted.' });
      }
    });
  });

  // Raw-body Stripe webhook endpoint BEFORE express.json so HMAC-SHA256 verification matches raw payload
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }), (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const signature = typeof req.headers['stripe-signature'] === 'string' ? req.headers['stripe-signature'] : undefined;
    const verification = verifyStripeWebhookSignature(rawBody, signature);
    if (!verification.valid) {
      res.status(400).json({ error: verification.reason || 'WEBHOOK_SIGNATURE_INVALID' });
      return;
    }

    try {
      const event = JSON.parse(rawBody.toString('utf-8')) as {
        id?: string;
        type?: string;
        data?: { object?: { client_reference_id?: string; metadata?: Record<string, string>; payment_status?: string } };
      };
      if (event.id && !markWebhookEventIfNew(event.id)) {
        res.json({ received: true, duplicate: true });
        return;
      }

      if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
        const uid = event.data.object.client_reference_id || event.data.object.metadata?.uid;
        const planId = event.data.object.metadata?.planId;
        const billingCycle = event.data.object.metadata?.billingCycle === 'annual' ? 'annual' : 'monthly';
        if (uid && (planId === 'pro' || planId === 'business')) {
          setVerifiedUserPlan(uid, planId, billingCycle);
        }
      }
      res.json({ received: true });
    } catch {
      res.status(400).json({ error: 'MALFORMED_WEBHOOK_PAYLOAD' });
    }
  });

  app.use(express.json({ limit: '512kb' }));

  const diagnosticsLimiter = createSlidingRateLimiter({ windowMs: 60_000, maxRequests: 45 });
  const aiLimiter = createSlidingRateLimiter({ windowMs: 60_000, maxRequests: 20 });
  const billingLimiter = createSlidingRateLimiter({ windowMs: 60_000, maxRequests: 15 });

  app.use('/api/diagnostics', diagnosticsLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api/billing', billingLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'novyra-net', nodeEnv: process.env.NODE_ENV || 'development' });
  });

  // Server list & live server reachability probe
  app.get('/api/servers', (_req, res) => {
    res.json({ servers: CONFIGURED_SERVERS });
  });

  app.get('/api/servers/probe', async (_req, res) => {
    const results = await Promise.all(
      CONFIGURED_SERVERS.map(async (srv) => {
        if (srv.host === 'self') {
          return {
            ...srv,
            status: 'online' as const,
            latencyMs: 0,
            checkedAt: new Date().toISOString(),
          };
        }
        const probe = await probeHttpsEndpoint(srv.host);
        return {
          ...srv,
          status: probe.available ? ('online' as const) : ('unreachable' as const),
          latencyMs: probe.latencyMs,
          error: probe.error,
          checkedAt: new Date().toISOString(),
        };
      }),
    );
    res.json({ servers: results });
  });

  // Server-observed connection metadata (never fabricated)
  app.get('/api/network/server-view', (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress || null;
    const cleanIp = rawIp?.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      observedIp: cleanIp,
      protocol: req.protocol,
      httpVersion: req.httpVersion,
      hostHeader: req.hostname,
      timestamp: new Date().toISOString(),
    });
  });

  // Network Diagnostics Endpoints
  app.get('/api/diagnostics/dns', async (req, res) => {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : '';
    const typesParam = typeof req.query.types === 'string' ? req.query.types.split(',') : undefined;
    try {
      const result = await lookupDnsRecords(domain, typesParam);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'DNS lookup failed.' });
    }
  });

  app.post('/api/diagnostics/tcp-ping', async (req, res) => {
    const host = typeof req.body?.host === 'string' ? req.body.host : '';
    const port = req.body?.port !== undefined ? Number(req.body.port) : 443;
    const count = req.body?.count !== undefined ? Number(req.body.count) : 4;
    try {
      const result = await runTcpPing(host, port, count);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'TCP ping failed.' });
    }
  });

  app.post('/api/diagnostics/port-check', async (req, res) => {
    const host = typeof req.body?.host === 'string' ? req.body.host : '';
    const port = Number(req.body?.port);
    try {
      const result = await checkPort(host, port);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Port check failed.' });
    }
  });

  app.get('/api/diagnostics/traceroute-capability', async (_req, res) => {
    const capability = await detectTracerouteCapability();
    res.json(capability);
  });

  app.post('/api/diagnostics/traceroute', async (req, res) => {
    const host = typeof req.body?.host === 'string' ? req.body.host : '';
    try {
      const result = await runTraceroute(host);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Traceroute failed.' });
    }
  });

  // Billing & Entitlements Endpoints
  app.get('/api/billing/status', (_req, res) => {
    res.json(getPublicBillingSummary());
  });

  app.get('/api/billing/my-subscription', requireAuth({ requireVerified: true }), (req, res) => {
    const caller = (req as express.Request & { caller?: VerifiedCaller }).caller!;
    res.json({
      subscription: getVerifiedUserSubscription(caller.uid),
    });
  });

  app.post('/api/billing/checkout', requireAuth({ requireVerified: true }), async (req, res) => {
    const caller = (req as express.Request & { caller?: VerifiedCaller }).caller!;
    const planId = req.body?.planId === 'business' ? 'business' : req.body?.planId === 'pro' ? 'pro' : null;
    const billingCycle = req.body?.billingCycle === 'annual' ? 'annual' : 'monthly';
    const unitAmountCents = Number(req.body?.unitAmountCents);
    const currency = typeof req.body?.currency === 'string' ? req.body.currency.slice(0, 6) : 'USD';
    const planName = typeof req.body?.planName === 'string' ? req.body.planName.slice(0, 60) : planId || 'Pro';
    const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.slice(0, 40) : undefined;

    if (!planId) {
      res.status(400).json({ error: 'INVALID_PLAN', message: 'Valid paid planId (pro or business) is required.' });
      return;
    }

    const appUrl =
      process.env.APP_URL?.trim() ||
      `${req.protocol}://${req.get('host') || 'localhost:3000'}`;

    try {
      const session = await createStripeCheckoutSession({
        uid: caller.uid,
        email: caller.email || '',
        planId,
        billingCycle,
        unitAmountCents,
        currency,
        planName,
        appUrl,
        couponCode,
      });
      res.json(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout unavailable.';
      if (message === 'PAYMENT_NOT_CONFIGURED' || message === 'PLAN_PRICING_NOT_CONFIGURED') {
        res.status(503).json({
          error: message,
          message:
            message === 'PAYMENT_NOT_CONFIGURED'
              ? 'Payment provider credentials (STRIPE_SECRET_KEY) are not configured on the server.'
              : 'Plan pricing is not configured cleanly for live checkout.',
        });
        return;
      }
      res.status(502).json({ error: 'CHECKOUT_ERROR', message });
    }
  });

  app.get('/api/billing/checkout-status', requireAuth({ requireVerified: true }), async (req, res) => {
    const caller = (req as express.Request & { caller?: VerifiedCaller }).caller!;
    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';
    if (!sessionId || sessionId.length > 200) {
      res.status(400).json({ error: 'INVALID_SESSION_ID', message: 'Missing or invalid session_id.' });
      return;
    }

    try {
      const verification = await verifyStripeCheckoutSession(sessionId, caller.uid);
      res.json(verification);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify checkout session.';
      res.status(message === 'PAYMENT_NOT_CONFIGURED' ? 503 : 400).json({
        error: message === 'PAYMENT_NOT_CONFIGURED' ? 'PAYMENT_NOT_CONFIGURED' : 'VERIFY_FAILED',
        message,
      });
    }
  });

  // Admin System Configuration Status (Masked Only)
  app.get('/api/admin/system-status', requireAuth({ requireVerified: true, requireAdmin: true }), (_req, res) => {
    res.json(getAdminSystemStatus(isAiConfigured()));
  });

  // NOVYRA AI Network Advisor Endpoints
  app.get('/api/ai/status', async (req, res) => {
    let caller: VerifiedCaller | null = null;
    try {
      caller = await verifyFirebaseBearerToken(req);
    } catch {
      caller = null;
    }
    const ipKey = req.ip || req.socket.remoteAddress || 'unknown';
    const quota = getAiQuotaStatus(caller?.uid ?? null, ipKey, caller?.isAdmin ?? false);
    res.json({
      configured: isAiConfigured(),
      model: 'gemini-4-hydrogen',
      quota,
    });
  });

  app.post('/api/ai/analyze', async (req, res) => {
    if (!isAiConfigured()) {
      res.status(503).json({
        error: 'AI_NOT_CONFIGURED',
        message: 'NOVYRA AI requires a server-side GEMINI_API_KEY configured in environment secrets.',
      });
      return;
    }

    let caller: VerifiedCaller | null = null;
    try {
      caller = await verifyFirebaseBearerToken(req);
    } catch {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Your session token expired or is invalid. Please sign in again.',
      });
      return;
    }

    const ipKey = req.ip || req.socket.remoteAddress || 'unknown';
    const quota = checkAndConsumeAiQuota({
      uid: caller?.uid ?? null,
      ipKey,
      isAdmin: caller?.isAdmin ?? false,
    });

    if (!quota.allowed) {
      res.status(403).json({
        error: 'AI_QUOTA_EXCEEDED',
        message:
          caller?.uid
            ? `Daily AI Advisor quota reached (${quota.used}/${quota.limit}). Upgrade your plan for higher daily AI limits.`
            : `Guest trial AI limit reached (${quota.used}/${quota.limit}). Sign in or upgrade to continue using NOVYRA AI.`,
        quota,
      });
      return;
    }

    try {
      const language = req.body?.language === 'ar' ? 'ar' : 'en';
      const result = await generateNetworkAnalysis({
        language,
        latestTest: req.body?.latestTest ?? null,
        previousTest: req.body?.previousTest ?? null,
        connectionInfo: req.body?.connectionInfo ?? null,
        question: typeof req.body?.question === 'string' ? req.body.question.slice(0, 1500) : undefined,
      });
      res.json({ ...result, quota });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI analysis failed.';
      res.status(502).json({ error: 'AI_UPSTREAM_ERROR', message: msg });
    }
  });

  // Mount Vite middleware in dev or serve built assets in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const listen = (port: number): void => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`NOVYRA Net server running at http://localhost:${port}`);
    });

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && !HAS_EXPLICIT_PORT && port < REQUESTED_PORT + 10) {
        console.warn(`Port ${port} is busy; trying ${port + 1}.`);
        listen(port + 1);
        return;
      }
      throw error;
    });
  };

  listen(REQUESTED_PORT);
}

createApp().catch((err) => {
  console.error('Failed to start NOVYRA Net server:', err);
  process.exit(1);
});
