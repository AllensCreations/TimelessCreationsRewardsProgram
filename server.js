import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mainHandler from './api/main.js';
import webhookHandler from './api/webhook.js';
import simulatorHandler from './api/simulator.js';
import cronHandler from './api/cron.js';
import brevoWebhookHandler from './api/brevo-webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB limit for high-res base64 image uploads & DoS protection

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const ALLOWED_ROOTS = [
  path.resolve(__dirname, 'public'),
  path.resolve(__dirname, 'views')
];

function isSafePath(resolvedPath) {
  return ALLOWED_ROOTS.some(root => resolvedPath === root || resolvedPath.startsWith(root + path.sep));
}

const server = http.createServer(async (req, res) => {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = function(data) {
    if (typeof data === 'object' && !Buffer.isBuffer(data)) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(data);
    }
    return res;
  };

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  req.query = Object.fromEntries(urlObj.searchParams);

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    let bodyStr = '';
    let receivedBytes = 0;
    let bodyTooLarge = false;

    await new Promise((resolve) => {
      req.on('data', chunk => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_BODY_SIZE) {
          bodyTooLarge = true;
          req.destroy();
          resolve();
          return;
        }
        bodyStr += chunk;
      });
      req.on('end', resolve);
      req.on('error', () => resolve());
    });

    if (bodyTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Payload Too Large (max 20MB)' }));
    }

    req.rawBody = bodyStr;
    try {
      req.body = JSON.parse(bodyStr);
    } catch (e) {
      req.body = bodyStr;
    }
  }

  if (pathname.startsWith('/api/webhook')) {
    return webhookHandler(req, res);
  }
  if (pathname.startsWith('/api/brevo-webhook')) {
    return brevoWebhookHandler(req, res);
  }
  if (pathname.startsWith('/api/cron')) {
    return cronHandler(req, res);
  }
  if (pathname.startsWith('/api/simulator')) {
    return simulatorHandler(req, res);
  }
  if (pathname.startsWith('/api/main') || pathname.startsWith('/api/')) {
    return mainHandler(req, res);
  }

  let cleanPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let targetFile = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\//, '');

  if (!path.extname(targetFile)) {
    targetFile += '.html';
  }

  // Professional route redirects for backward compatibility
  const LEGACY_REDIRECTS = {
    'messengerbot.html': '/campaigns.html?tab=rewards',
    'drips.html': '/campaigns.html',
    'missionaries.html': '/roster.html',
    'pusher.html': '/enrollment.html',
    'messenger-test.html': '/simulator.html'
  };

  if (LEGACY_REDIRECTS[targetFile]) {
    res.writeHead(302, { 'Location': LEGACY_REDIRECTS[targetFile] });
    return res.end();
  }

  const searchPaths = [
    path.resolve(__dirname, 'public', targetFile),
    path.resolve(__dirname, 'views', targetFile)
  ];

  let resolvedPath = null;
  for (const p of searchPaths) {
    if (isSafePath(p) && fs.existsSync(p) && fs.statSync(p).isFile()) {
      resolvedPath = p;
      break;
    }
  }

  if (resolvedPath) {
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    return fs.createReadStream(resolvedPath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Timeless Creations Server running on http://localhost:${PORT}`);
});
