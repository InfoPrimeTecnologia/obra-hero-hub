import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
};

async function serveStatic(req, res, filePath) {
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function startServer() {
  // Try to load the worker entry
  let workerHandler = null;
  try {
    const workerModule = await import('./dist/server/index.js');
    workerHandler = workerModule.default || workerModule.createServerEntry;
    console.log('Worker handler loaded successfully');
  } catch (e) {
    console.warn('Could not load worker handler:', e.message);
    console.warn('Falling back to static-only mode (SSR will not work)');
  }

  const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Try to handle via worker first (for API routes and SSR)
    if (workerHandler) {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        // Don't use worker for static assets (serve directly for performance)
        const staticPath = join(__dirname, 'dist/client', url.pathname);
        const isAsset = url.pathname.startsWith('/assets/') || 
                       url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);
        
        if (!isAsset) {
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
          }

          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks);

          const request = new Request(url, {
            method: req.method,
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
          });

          const response = await workerHandler(request, {
            waitUntil: () => {},
            passThroughOnException: () => {},
            env: {
              SUPABASE_URL: process.env.SUPABASE_URL,
              SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
            },
          });

          res.statusCode = response.status;
          for (const [key, value] of response.headers) {
            res.setHeader(key, value);
          }

          const responseBody = await response.arrayBuffer();
          res.end(Buffer.from(responseBody));
          return;
        }
      } catch (e) {
        // If worker fails, fall through to static serving
        console.error('Worker error:', e.message);
      }
    }

    // Static file serving
    const urlPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = join(__dirname, 'dist/client', urlPath.split('?')[0]);
    await serveStatic(req, res, filePath);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Mestre 360 server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  });
}

startServer().catch(console.error);
