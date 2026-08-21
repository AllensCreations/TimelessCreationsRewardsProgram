import "dotenv/config";
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mainHandler from './api/main.js';
import webhookHandler from './api/webhook.js';

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

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. API Route Handlers
  if (pathname.startsWith('/api/webhook')) {
    return webhookHandler(req, res);
  }
  if (pathname.startsWith('/api/main') || pathname.startsWith('/api/')) {
    return mainHandler(req, res);
  }

  // 2. Static File Resolution (public, views, root)
  let targetFile = pathname === '/' ? '/views/index.html' : pathname;
  
  // Check if requesting an html page without extension
  if (!path.extname(targetFile)) {
    if (fs.existsSync(path.join(__dirname, 'views', `${targetFile}.html`))) {
      targetFile = `/views/${targetFile}.html`;
    } else if (fs.existsSync(path.join(__dirname, 'public', `${targetFile}.html`))) {
      targetFile = `/public/${targetFile}.html`;
    }
  }

  const searchPaths = [
    path.join(__dirname, targetFile),
    path.join(__dirname, 'public', targetFile.replace(/^\/public\//, '/')),
    path.join(__dirname, 'views', targetFile.replace(/^\/views\//, '/'))
  ];

  let resolvedPath = null;
  for (const p of searchPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
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

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Timeless Creations Server running on http://localhost:${PORT}`);
});
