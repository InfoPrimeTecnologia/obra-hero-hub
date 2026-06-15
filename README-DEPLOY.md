# Deploy do Mestre 360 no aapanel

Este guia explica como fazer o deploy do sistema Mestre 360 em um servidor com **aapanel**.

## Requisitos do Servidor

- **Node.js 20+** (recomendado: Node.js 22 LTS)
- **PM2** (para gerenciar o processo Node.js)
- **Nginx** (o aapanel ja instala automaticamente)

---

## Preparacao (na Lovable)

### Opcao 1: Build automatico (recomendado)

Na Lovable, execute:

```bash
bash deploy-aapanel.sh
```

Ou com pacote ZIP:

```bash
bash deploy-aapanel.sh --zip
```

### Opcao 2: Build manual

```bash
# Instalar dependencias
bun install   # ou: npm install

# Fazer build
bun run build # ou: npm run build
```

---

## Deploy no Servidor (aapanel)

### 1. Criar o site no aapanel

1. Acesse o aapanel
2. Va em **Website** -> **Add Site**
3. Escolha **Node Project**
4. Preencha:
   - Project name: `mestre360`
   - Project path: `/www/wwwroot/mestre360` (ou o caminho desejado)
   - Startup file: `server.js`
   - Port: `3000`

### 2. Enviar os arquivos

Via SSH/FTP, envie para a pasta do site:

```
/www/wwwroot/mestre360/
  |- dist/
  |   |- client/     (assets estaticos)
  |   |- server/     (bundle do servidor)
  |- server.js       (entry point)
  |- package.json
  |- node_modules/   (dependencias instaladas)
```

### 3. Instalar dependencias no servidor

```bash
cd /www/wwwroot/mestre360
npm install --production
```

### 4. Configurar variaveis de ambiente

Crie o arquivo `.env.production.local` na raiz. Esse arquivo fica fora do Git e sobrescreve o `.env` do repositório em produção:

```bash
cd /www/wwwroot/mestre360
nano .env.production.local
```

Conteudo do `.env.production.local`:

```env
# Backend (obrigatorio)
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY

# Build do frontend (obrigatorio antes de rodar npm run build)
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA

# Porta do servidor
PORT=3000

# Opcional: ambiente
NODE_ENV=production
```

> **IMPORTANTE:** mantenha as chaves reais apenas em `.env.production.local`. O `git pull` pode substituir o `.env` do repositório, mas não deve tocar nesse arquivo local.

### 5. Iniciar com PM2

```bash
cd /www/wwwroot/mestre360

# Iniciar o servidor
pm2 start server.js --name mestre360

# Salvar configuracao para iniciar automaticamente
pm2 save
pm2 startup
```

Verifique se esta rodando:

```bash
pm2 status
pm2 logs mestre360
```

### 6. Configurar Nginx (reverse proxy)

No aapanel:
1. Va em **Website** -> clique no site `mestre360` -> **Settings**
2. Va na aba **Reverse Proxy**
3. Adicione:
   - Target URL: `http://127.0.0.1:3000`
   - Send domain: `off` (ou o dominio configurado)

Ou edite o arquivo de config diretamente:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Atualizacoes Futuras

Quando fizer alteracoes na Lovable e quiser atualizar o servidor:

```bash
# 1. Na Lovable: refazer o build
bun run build

# 2. Envie os novos arquivos (via FTP/SSH)
#    - dist/
#    - server.js
#    - package.json (se mudou dependencias)

# 3. No servidor:
cd /www/wwwroot/mestre360

# Se mudou package.json:
npm install --production

# Reiniciar o PM2
pm2 restart mestre360
```

---

## Solucao de Problemas

### Servidor nao inicia

```bash
# Ver logs
pm2 logs mestre360

# Testar manualmente
node server.js
```

### Erro 404 em rotas

Verifique se o Nginx esta configurado corretamente como reverse proxy. O SPA fallback esta no `server.js`, mas o Nginx deve passar todas as rotas para o Node.js.

### Variaveis de ambiente nao carregam

Instale o `dotenv` se necessario:

```bash
npm install dotenv
```

E adicione no topo do `server.js`:

```javascript
import 'dotenv/config';
```

Ou use o PM2 ecosystem file (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'mestre360',
    script: './server.js',
    env: {
      SUPABASE_URL: '...',
      SUPABASE_PUBLISHABLE_KEY: '...',
      SUPABASE_SERVICE_ROLE_KEY: '...',
      PORT: 3000,
    }
  }]
};
```

---

## Estrutura de Arquivos Enviados

```
mestre360/
  |- dist/
  |   |- client/
  |   |   |- index.html
  |   |   |- assets/
  |   |   |   |- styles-xxx.css
  |   |   |   |- index-xxx.js
  |   |   |- mestre360-logo.png
  |   |- server/
  |       |- index.js
  |       |- assets/
  |- server.js
  |- package.json
  |- node_modules/
  |- .env
```

---

## Suporte

Para problemas relacionados ao codigo, faca as correcoes na Lovable e refaca o build.
Para problemas de servidor/infraestrutura, verifique os logs do PM2 e do Nginx.
