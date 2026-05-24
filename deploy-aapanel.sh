#!/bin/bash
set -e

echo "===================================="
echo "  MESTRE 360 - BUILD PARA AAPANEL"
echo "===================================="
echo ""

# Verificar dependencias
if ! command -v node &> /dev/null; then
    echo "Node.js nao encontrado. Instale o Node.js 20+"
    exit 1
fi

if ! command -v bun &> /dev/null && ! command -v npm &> /dev/null; then
    echo "Nem bun nem npm encontrados. Instale um deles."
    exit 1
fi

# Usar bun se disponivel, senao npm
if command -v bun &> /dev/null; then
    PKG_MGR="bun"
    INSTALL_CMD="bun install"
    BUILD_CMD="bun run build"
else
    PKG_MGR="npm"
    INSTALL_CMD="npm install"
    BUILD_CMD="npm run build"
fi

echo "Gerenciador de pacotes: $PKG_MGR"
echo ""

# Limpar build anterior
echo "[1/5] Limpando build anterior..."
rm -rf dist/

# Instalar dependencias
echo "[2/5] Instalando dependencias..."
$INSTALL_CMD

# Fazer o build
echo "[3/5] Fazendo build de producao..."
$BUILD_CMD

# Verificar se o build foi gerado
if [ ! -d "dist" ]; then
    echo "ERRO: Pasta dist/ nao foi gerada!"
    exit 1
fi

echo "[4/5] Build concluido com sucesso!"
echo ""
echo "Arquivos gerados:"
echo "  - dist/client/  (arquivos estaticos)"
echo "  - dist/server/  (bundle do servidor)"
echo "  - server.js     (entry point Node.js)"
echo ""

# Criar pacote para deploy (opcional)
if [ "$1" == "--zip" ] || [ "$1" == "-z" ]; then
    echo "[5/5] Criando pacote ZIP para deploy..."
    
    # Criar pasta temporaria
    mkdir -p deploy-temp
    
    # Copiar arquivos necessarios
    cp -r dist deploy-temp/
    cp server.js deploy-temp/
    cp package.json deploy-temp/
    cp -r node_modules deploy-temp/ 2>/dev/null || true
    
    # Criar .env de exemplo
    cat > deploy-temp/.env.example << 'EOF'
# Copie este arquivo para .env e preencha com suas variaveis
SUPABASE_URL=https://sua-url.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
PORT=3000
EOF

    # Criar ZIP
    zip -r mestre360-deploy.zip deploy-temp/
    rm -rf deploy-temp/
    
    echo ""
    echo "Pacote criado: mestre360-deploy.zip"
    echo ""
fi

echo "===================================="
echo "  BUILD FINALIZADO!"
echo "===================================="
echo ""
echo "Para rodar localmente:"
echo "  npm start"
echo ""
echo "Para deploy no aapanel:"
echo "  1. Envie os arquivos para o servidor"
echo "  2. Instale dependencias: npm install"
echo "  3. Configure as variaveis de ambiente (.env)"
echo "  4. Inicie com PM2: pm2 start server.js --name mestre360"
echo ""
