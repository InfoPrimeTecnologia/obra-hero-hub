import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
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

function serveFile(res, filePath, statusCode = 200) {
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(statusCode, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(content);
    return true;
  } catch (e) {
    return false;
  }
}

async function startServer() {
  let workerHandler = null;
  try {
    const workerModule = await import('./dist/server/index.js');
    workerHandler = workerModule.default?.fetch;
    if (typeof workerHandler !== 'function') {
      console.warn('Worker default.fetch is not a function');
      workerHandler = null;
    } else {
      console.log('Worker handler loaded successfully');
    }
  } catch (e) {
    console.warn('Could not load worker handler:', e.message);
    console.warn('Falling back to static-only mode (SSR will not work)');
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // 1. Try worker for non-asset routes (API + SSR pages)
    const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|eot|json|txt)$/);
    
    if (workerHandler && !isStaticAsset) {
      try {
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
          if (key.toLowerCase() !== 'content-encoding') {
            res.setHeader(key, value);
          }
        }

        const responseBody = await response.arrayBuffer();
        res.end(Buffer.from(responseBody));
        return;
      } catch (e) {
        console.error('Worker error:', e.message);
      }
    }

    // 2. Static file serving
    const urlPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = join(__dirname, 'dist/client', urlPath.split('?')[0]);

    if (serveFile(res, filePath)) return;

    // 3. SPA fallback: if HTML page not found, serve index.html for client-side routing
    if (!isStaticAsset) {
      const indexPath = join(__dirname, 'dist/client/index.html');
      if (serveFile(res, indexPath, 200)) return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Not Found</h1>');
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Mestre 360 server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  });
}

startServer().catch(console.error);
