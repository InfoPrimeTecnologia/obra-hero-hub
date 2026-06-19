INSERT INTO public.app_releases (version, released_at, highlight, items) VALUES (
  '1.1.0',
  now(),
  'Workspace dedicado por obra: sidebar contextual, Medições, Curva S, Notificações e atalhos',
  '[
    {"type":"feature","description":"Workspace dedicado por obra: ao entrar em uma obra, a sidebar passa a mostrar apenas os módulos da obra (Visão, Planejamento, RDO, Compras, Consulta de Suprimentos, Fornecedores, Caixa, Faturas, Contas a Pagar, Pagamentos, RH, Relatórios)."},
    {"type":"feature","description":"Botão Abrir obra nos cards de Obras leva direto ao painel da obra selecionada."},
    {"type":"feature","description":"Atalho Última obra na barra superior para voltar rapidamente ao último projeto acessado."},
    {"type":"feature","description":"Breadcrumb Empresa › Obra › Seção em todas as telas dentro do escopo da obra."},
    {"type":"feature","description":"Medições por etapa: registre o avanço físico (%) das subetapas de cada obra."},
    {"type":"feature","description":"Curva S em Relatórios → Orçado x Realizado: comparativo acumulado de planejado vs físico (medições) vs financeiro (compras)."},
    {"type":"feature","description":"Notificações in-app no sino do topo: contas a pagar vencendo em até 3 dias, faturas de cartão fechando e obras sem RDO há 7 dias ou mais."},
    {"type":"feature","description":"Novos relatórios por obra: Compras, Pagamentos e Orçado x Realizado, todos com filtros dedicados ao escopo da obra."},
    {"type":"improvement","description":"Planejamento (Engenharia) e Consulta (Suprimentos) ganham telas próprias dentro de cada obra."},
    {"type":"improvement","description":"Meios de pagamento concentrados dentro da obra para facilitar conciliação por projeto."}
  ]'::jsonb
);