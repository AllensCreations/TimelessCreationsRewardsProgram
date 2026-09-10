import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mainHandler from './api/main.js';
import webhookHandler from './api/webhook.js';
import simulatorHandler from './api/simulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

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
  return ALLOWED_ROOTS.some(root => resolvedPath.startsWith(root));
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

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  req.query = Object.fromEntries(urlObj.searchParams);

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    await new Promise(resolve => req.on('end', resolve));
    try {
      req.body = JSON.parse(bodyStr);
    } catch (e) {
      req.body = bodyStr;
    }
  }

  if (pathname.startsWith('/api/webhook')) {
    return webhookHandler(req, res);
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
