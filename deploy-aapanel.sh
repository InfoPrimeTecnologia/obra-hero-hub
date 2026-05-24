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
echo "[1/4] Limpando..."
rm -rf dist/

echo "[2/4] Instalando dependencias..."
$INSTALL_CMD

echo "[3/4] Build de producao..."
$BUILD_CMD

echo "[4/4] Gerando index.html para SPA fallback..."
node -e "
const m = await import('./dist/server/index.js');
const handler = m.default.fetch;
const req = new Request('http://localhost/');
handler(req, { waitUntil: () => {}, passThroughOnException: () => {}, env: {} }).then(async res => {
  const fs = require('fs');
  const html = await res.text();
  fs.writeFileSync('./dist/client/index.html', html);
  console.log('index.html gerado (' + html.length + ' bytes)');
});
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
