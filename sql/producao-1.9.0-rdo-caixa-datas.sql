-- =============================================================================
-- Mestre 360 — Produção — v1.9.0
-- RDO com campos nomeados, envio de WhatsApp com PDF, datas corretas no
-- financeiro, saldo atual e relatório completo de Caixa e Bancos.
-- Idempotente. Rodar no SQL Editor do Supabase de PRODUÇÃO.
-- =============================================================================

-- Não há mudança de schema nesta versão (correções são de aplicação).
-- Registro no changelog:
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES (
  '1.9.0',
  'RDO mais claro, WhatsApp com PDF e Caixa e Bancos completo',
  '["RDO: todos os campos de equipe, atividades e ocorrências agora têm rótulo descritivo","WhatsApp: o PDF do RDO e as fotos voltam a ser enviados (texto sempre entregue, mídia com compatibilidade de campos do PrimeSync)","Financeiro: datas deixam de aparecer com um dia a menos em pagamentos, extratos e relatórios","Caixa e Bancos: novo indicador de Saldo atual das contas da obra","Caixa e Bancos: relatório completo em PDF e Excel com resumo, saldos por conta e extrato com saldo acumulado"]'::jsonb,
  now()
)
ON CONFLICT (version) DO NOTHING;

-- ATENÇÃO (envio de WhatsApp): confirme no servidor de produção as variáveis
--   PRIMESYNC_URL   = https://SEU-HOST/v1/api/external/<id-da-conexao>
--   PRIMESYNC_TOKEN = <token da API>
-- Sem elas o botão WhatsApp retorna erro de configuração.
