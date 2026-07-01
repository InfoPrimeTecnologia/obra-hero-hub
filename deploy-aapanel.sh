#!/bin/bash
set -e

echo "===================================="
echo "  MESTRE 360 - BUILD PARA AAPANEL"
echo "===================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "Node.js nao encontrado. Instale o Node.js 20+"
    exit 1
fi

if command -v bun &> /dev/null; then
    PKG_MGR="bun"
    INSTALL_CMD="bun install"
    BUILD_CMD="bun run build"
else
    PKG_MGR="npm"
    INSTALL_CMD="npm install"
    BUILD_CMD="npm run build"
fi

echo "Gerenciador: $PKG_MGR"

# Build
echo "[1/5] Limpando..."
rm -f server.js pm2-server.mjs
rm -rf dist/ .vite node_modules/.vite .output

echo "[2/5] Instalando dependencias..."
$INSTALL_CMD

echo "[3/5] Build de producao..."
$BUILD_CMD

echo "[4/5] Preparando entrypoint do PM2..."
cp prod-server.mjs pm2-server.mjs

echo "[5/5] Gerando index.html para SPA fallback..."
node --input-type=module - <<'NODE' || echo "Aviso: index.html nao gerado automaticamente"
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function serverEntryCandidates() {
  const candidates = [];
  for (const manifestPath of ['dist/nitro.json', '.output/nitro.json']) {
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.serverEntry) candidates.push(resolve(root, dirname(manifestPath), manifest.serverEntry));
    } catch (e) {
      console.warn('Aviso: nao foi possivel ler ' + manifestPath + ': ' + e.message);
    }
  }
  candidates.push(
    resolve(root, 'dist/server/index.mjs'),
    resolve(root, 'dist/server/server.js'),
    resolve(root, 'dist/server/index.js'),
    resolve(root, '.output/server/index.mjs'),
  );
  return [...new Set(candidates)];
}

const entry = serverEntryCandidates().find((path) => existsSync(path));
if (!entry) {
  console.warn('Aviso: nenhum bundle de servidor encontrado; o PM2 ainda tentara carregar o app em runtime.');
  process.exit(0);
}

const mod = await import(pathToFileURL(entry).href);
const handler = typeof mod.default === 'function' ? mod.default : mod.default?.fetch?.bind(mod.default) || mod.fetch;
if (typeof handler !== 'function') {
  console.warn('Aviso: bundle de servidor encontrado, mas sem fetch handler: ' + entry);
  process.exit(0);
}

const env = {
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

const context = {
  waitUntil: () => {},
  passThroughOnException: () => {},
};

const req = new Request(process.env.APP_URL || 'http://localhost/');
const res = await handler(req, env, context);
const html = await res.text();

const clientDir = ['./dist/client', './.output/public', './dist/public'].find((path) => existsSync(path));
if (!clientDir || !html.includes('<html')) {
  console.warn('Aviso: resposta SSR nao parece HTML; fallback estatico nao foi gerado.');
  process.exit(0);
}

writeFileSync(join(clientDir, 'index.html'), html);
console.log('index.html gerado (' + html.length + ' bytes) usando ' + entry);
NODE

if [ ! -d "dist" ]; then
    echo "ERRO: dist/ nao foi gerada!"
    exit 1
fi

echo ""
echo "===================================="
echo "  BUILD FINALIZADO!"
echo "===================================="
echo ""
echo "Para rodar localmente: npm start"
echo "Para deploy: envie os arquivos para o servidor e rode 'npm install --production && pm2 start pm2-server.mjs --name mestre360'"
echo ""
