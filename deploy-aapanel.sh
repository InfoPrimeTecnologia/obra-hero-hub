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
rm -rf dist/ .vite node_modules/.vite .output

echo "[2/5] Instalando dependencias..."
$INSTALL_CMD

echo "[3/5] Build de producao..."
$BUILD_CMD

echo "[4/5] Preparando entrypoint do PM2..."
cp prod-server.mjs server.js

echo "[5/5] Gerando index.html para SPA fallback..."
node --input-type=module -e "
import { existsSync, writeFileSync } from 'node:fs';

const candidates = ['./dist/server/server.js', './dist/server/index.js'];
const entry = candidates.find((path) => existsSync(path));
if (!entry) throw new Error('Nenhum bundle de servidor encontrado em dist/server');

const m = await import(entry);
const handler = m.default?.fetch;
if (typeof handler !== 'function') throw new Error('Bundle de servidor sem default.fetch');

const req = new Request(process.env.APP_URL || 'http://localhost/');
const res = await handler(req, {
  waitUntil: () => {},
  passThroughOnException: () => {},
  env: {
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
  },
});

const html = await res.text();
writeFileSync('./dist/client/index.html', html);
console.log('index.html gerado (' + html.length + ' bytes) usando ' + entry);
" || echo "Aviso: index.html nao gerado automaticamente"

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
echo "Para deploy: envie os arquivos para o servidor e rode 'npm install --production && pm2 start server.js --name mestre360'"
echo ""
