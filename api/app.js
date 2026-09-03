/**
 * Figment API BFF — keeps FIGMENT_API_KEY on the server.
 * Local: `npm run dev` (Express listen). Vercel: serverless via api/index.js.
 *
 * Env:
 *   FIGMENT_API_KEY   (required, Secret on Vercel)
 *   ALLOWED_ORIGINS   (optional) comma-separated browser origins for CORS
 *   PORT              (optional, local only; default 3000)
 */

require('dotenv').config();

const express = require('express');

const FIGMENT_API_BASE = 'https://api.figment.io';

const ALLOWED_PREFIXES = [
  'solana/stake',
  'solana/broadcast',
  'solana/undelegate',
  'solana/withdraw',
  'solana/stakes',
];

function isAllowedPath(segments) {
  const joined = segments.join('/');
  return ALLOWED_PREFIXES.some(
    (prefix) => joined === prefix || joined.startsWith(`${prefix}/`)
  );
}

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = parseAllowedOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function buildTargetUrl(segments, req) {
  const path = segments.join('/');
  const target = new URL(`${FIGMENT_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value)) {
      value.forEach((v) => target.searchParams.append(key, String(v)));
    } else if (value != null) {
      target.searchParams.append(key, String(value));
    }
  }
  return target.toString();
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

app.use('/api/figment', async (req, res) => {
  const apiKey = process.env.FIGMENT_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message:
          'FIGMENT_API_KEY is not configured on the server. Set it in .env (local) or Vercel Environment Variables (Secret).',
      },
    });
  }

  // Mounted at /api/figment → path is e.g. /solana/stakes
  const segments = req.path.split('/').filter(Boolean);

  if (!segments.length || !isAllowedPath(segments)) {
    return res.status(404).json({
      error: { message: 'Not found' },
    });
  }

  const targetUrl = buildTargetUrl(segments, req);
  const headers = {
    'x-api-key': apiKey,
  };

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    if (req.body != null && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
    } else if (typeof req.body === 'string' && req.body.length) {
      body = req.body;
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: {
        message: err?.message || 'Failed to reach Figment API',
      },
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Vercel 以外（ローカル）のときだけ HTTP サーバーを起動
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Local server is running on port ${port}`);
  });
}

// Vercel のサーバーレス関数としてエクスポート
module.exports = app;
