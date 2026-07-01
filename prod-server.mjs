import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: join(__dirname, '.env') });
loadEnv({ path: join(__dirname, '.env.production.local'), override: true });

const CLIENT_DIR_CANDIDATES = [
  join(__dirname, 'dist/client'),
  join(__dirname, '.output/public'),
  join(__dirname, 'dist/public'),
];

const FALLBACK_SERVER_ENTRY_CANDIDATES = [
  join(__dirname, 'dist/server/index.mjs'),
  join(__dirname, 'dist/server/server.js'),
  join(__dirname, 'dist/server/index.js'),
  join(__dirname, '.output/server/index.mjs'),
];

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

function getClientDir() {
  return CLIENT_DIR_CANDIDATES.find((path) => existsSync(path)) || CLIENT_DIR_CANDIDATES[0];
}

function getWorkerEnv() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_ENV: process.env.ASAAS_ENV,
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    SEND_EMAIL_HOOK_SECRET: process.env.SEND_EMAIL_HOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    PRIMESYNC_TOKEN: process.env.PRIMESYNC_TOKEN,
    PRIMESYNC_URL: process.env.PRIMESYNC_URL,
  };
}

function getWorkerContext() {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}

function getServerEntryCandidates() {
  const candidates = [];

  for (const manifestPath of [join(__dirname, 'dist/nitro.json'), join(__dirname, '.output/nitro.json')]) {
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.serverEntry) {
        candidates.push(resolve(dirname(manifestPath), manifest.serverEntry));
      }
    } catch (e) {
      console.warn(`Could not read ${manifestPath}:`, e.message);
    }
  }

  candidates.push(...FALLBACK_SERVER_ENTRY_CANDIDATES);
  return [...new Set(candidates)];
}

async function loadWorkerHandler() {
  const candidates = getServerEntryCandidates();

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;

    try {
      const workerModule = await import(pathToFileURL(candidate).href);
      const workerHandler = typeof workerModule.default === 'function'
        ? workerModule.default
        : workerModule.default?.fetch?.bind(workerModule.default) || workerModule.fetch;

      if (typeof workerHandler === 'function') {
        console.log(`Worker handler loaded successfully from ${candidate}`);
        return workerHandler;
      }
      console.warn(`Worker fetch handler is not a function in ${candidate}`);
    } catch (e) {
      console.warn(`Could not load worker handler from ${candidate}:`, e.message);
    }
  }

  console.warn('Falling back to static-only mode (SSR will not work)');
  return null;
}

async function startServer() {
  const workerHandler = await loadWorkerHandler();
  const clientDir = getClientDir();

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

        const response = await workerHandler(request, getWorkerEnv(), getWorkerContext());

        // SPA fallback: se worker retornar 404 para uma pagina, serve index.html
        if (response.status === 404 && !isStaticAsset) {
          const indexPath = join(clientDir, 'index.html');
          if (serveFile(res, indexPath, 200)) return;
        }

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
    const filePath = join(clientDir, urlPath.split('?')[0]);

    if (serveFile(res, filePath)) return;

    // 3. SPA fallback: if HTML page not found, serve index.html for client-side routing
    if (!isStaticAsset) {
      const indexPath = join(clientDir, 'index.html');
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
