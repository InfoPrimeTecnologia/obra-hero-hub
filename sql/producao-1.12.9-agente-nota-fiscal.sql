-- Mestre 360 v1.12.9 — Agente de IA: lançamento de nota fiscal mais barato e sem perder os itens
-- Só registra a versão no changelog (não altera tabelas). Pode rodar mais de uma vez.
INSERT INTO public.app_releases (version, highlight, items, released_at)
VALUES ('1.12.9', 'Agente de IA: lançamento de nota fiscal em uma pergunta',
 '[{"type":"improvement","description":"O agente lê a nota fiscal (XML, PDF ou foto) uma única vez, com o mesmo leitor da tela Nova compra, e não perde os itens durante a conversa."},{"type":"improvement","description":"Lançar nota pelo agente cobra só o lançamento da compra: as mensagens da conversa da nota não consomem créditos."},{"type":"improvement","description":"O agente mostra fornecedor, descrição, data, natureza e itens de uma vez e pergunta só a etapa/subetapa."}]'::jsonb, now())
ON CONFLICT (version) DO NOTHING;
