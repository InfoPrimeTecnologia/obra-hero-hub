import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  Building2,
  HardHat,
  ListTree,
  ClipboardList,
  Bell,
  LineChart,
  Search as SearchIcon,
  CalendarRange,
  ShoppingCart,
  Truck,
  Users,
  CreditCard,
  Wallet,
  Receipt,
  ArrowLeftRight,
  BarChart3,
  FileSpreadsheet,
  FileBarChart2,
  Tags,
  Sparkles,
  PlayCircle,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  FolderOpen,
  KanbanSquare,
  UserCog,
  Coins,
  LifeBuoy,
  Share2,
  Undo2,
  Bot,
  Landmark,
  ArrowDownToLine,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { startOnboardingTour } from "@/lib/onboarding-tour";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/manual")({
  component: ManualPage,
});

type Category =
  | "Começando"
  | "Obra"
  | "Engenharia"
  | "Suprimentos"
  | "Financeiro"
  | "Relatórios"
  | "Conta e acesso";

type Section = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  category: Category;
  to?: string;
  summary: string;
  steps: string[];
  tips?: string[];
  rules?: string[];
};

const CATEGORIES: Category[] = [
  "Começando",
  "Obra",
  "Engenharia",
  "Suprimentos",
  "Financeiro",
  "Relatórios",
  "Conta e acesso",
];

const SECTIONS: Section[] = [
  // ---------------------------------------------------------------- Começando
  {
    id: "visao-geral",
    title: "Visão geral do sistema",
    icon: BookOpen,
    category: "Começando",
    summary:
      "O Mestre 360 organiza tudo em dois níveis: a Empresa (visão consolidada de várias obras) e a Obra (workspace dedicado com orçamento, compras, RDO e financeiro próprios).",
    steps: [
      "Nível Empresa: menu lateral padrão — dashboard, cadastros, financeiro consolidado e relatórios de todas as obras.",
      'Nível Obra: ao clicar em "Abrir obra", a sidebar troca para o contexto da obra e tudo passa a ser filtrado por ela.',
      "A barra superior tem: busca global (Ctrl + K), seletor de obra ativa, sino de notificações, saldo de créditos e seu perfil.",
    ],
    rules: [
      "Tudo que é lançado dentro de uma obra aparece também na visão da empresa (consolidado).",
      "O contrário não é verdadeiro: lançamentos da empresa sem obra vinculada não aparecem dentro de nenhuma obra.",
    ],
  },
  {
    id: "empresas",
    title: "Empresas",
    icon: Building2,
    category: "Começando",
    to: "/app/empresas",
    summary:
      "Cadastre a(s) empresa(s) responsáveis pelas obras. Notas, contratos e financeiro ficam vinculados a uma empresa.",
    steps: [
      "Acesse Empresas no menu lateral.",
      'Clique em "Nova empresa" e preencha razão social, CNPJ, endereço e contatos.',
      "Defina a empresa padrão caso opere mais de uma — ela é pré-selecionada nos novos cadastros.",
    ],
    tips: ["Dados fiscais podem ser editados a qualquer momento e refletem em relatórios e notas futuras."],
  },
  {
    id: "primeiros-cadastros",
    title: "Ordem recomendada de configuração",
    icon: CheckCircle2,
    category: "Começando",
    summary:
      "Seguindo esta ordem você evita retrabalho: cada cadastro depende do anterior para funcionar corretamente.",
    steps: [
      "1) Empresa — base fiscal de tudo.",
      "2) Categorias financeiras — árvore de receitas e despesas usada em todos os relatórios.",
      "3) Contas bancárias e cartões — meios de pagamento (globais ou por obra).",
      "4) Fornecedores — podem ser criados também no ato da compra.",
      "5) Colaboradores (RH) — necessários para registrar efetivo no RDO.",
      "6) Obra + Orçamento por etapas/subetapas — libera compras, medições e Orçado x Realizado.",
    ],
  },
  {
    id: "busca-global",
    title: "Busca global e navegação",
    icon: SearchIcon,
    category: "Começando",
    summary: "Encontre obras, fornecedores, compras e telas do sistema sem navegar pelo menu.",
    steps: [
      "Pressione Ctrl + K (ou Cmd + K no Mac) em qualquer tela.",
      "Digite parte do nome da obra, fornecedor ou módulo.",
      "Use as setas e Enter para abrir o resultado.",
    ],
    tips: ["Ícones de informação (i) ao lado dos títulos explicam o que cada tela faz."],
  },

  // ---------------------------------------------------------------------- Obra
  {
    id: "obras",
    title: "Obras",
    icon: HardHat,
    category: "Obra",
    to: "/app/obras",
    summary:
      "A obra é o centro de tudo: orçamento, compras, RDOs, medições, financeiro e relatórios são organizados por obra.",
    steps: [
      'Vá em Obras → "Nova obra".',
      "Informe nome, endereço, datas de início/previsão e a empresa responsável.",
      "Anexe a foto de capa da obra (opcional) para identificação visual nos cards.",
      "Use o seletor de Obra Ativa na barra superior para focar o trabalho do dia em uma obra.",
    ],
    tips: [
      "A obra ativa filtra automaticamente compras, RDO, meios de pagamento e relatórios.",
      "Acompanhe o cronograma físico no Gantt (atalho no topo de cada obra).",
    ],
  },
  {
    id: "workspace-obra",
    title: "Workspace dedicado da obra",
    icon: HardHat,
    category: "Obra",
    summary:
      "Ao abrir uma obra, a sidebar muda para o contexto dela: Visão, Planejamento, Gantt, RDO, Medições, Compras, Consulta, Fornecedores, RH, Documentos, Financeiro da obra e Relatórios.",
    steps: [
      'Em Obras, clique em "Abrir obra" no card desejado.',
      "O breadcrumb no topo mostra Empresa › Obra › Seção.",
      "Para sair, use o botão Voltar ou navegue por Obras no topo.",
    ],
    tips: [
      "Tudo dentro do workspace já vem filtrado pela obra — não é preciso reaplicar filtros.",
      "No painel da obra, use o botão de editar contato para cadastrar nome, e-mail e WhatsApp do responsável — esse WhatsApp é usado no envio de RDO e relatórios.",
    ],
  },
  {
    id: "documentos-obra",
    title: "Documentos da obra",
    icon: FolderOpen,
    category: "Obra",
    summary:
      "Central de anexos da obra: contratos, ARTs, projetos, licenças, fotos e qualquer arquivo de referência.",
    steps: [
      "Dentro da obra, acesse Documentos.",
      "Clique em Enviar documento, escolha o arquivo e informe nome/descrição.",
      "Baixe, renomeie ou exclua a qualquer momento.",
    ],
    tips: ["Notas fiscais anexadas na compra continuam também dentro da própria compra."],
  },
  {
    id: "duplicar-obra",
    title: "Duplicar obra / template de orçamento",
    icon: Share2,
    category: "Obra",
    summary:
      "Crie uma obra nova reaproveitando a estrutura de etapas e subetapas de uma obra anterior.",
    steps: [
      "Em Obras, no menu do card da obra modelo, escolha Duplicar.",
      "Informe o nome da nova obra e confirme.",
      "Etapas e subetapas do orçamento são copiadas; lançamentos financeiros não são.",
    ],
  },
  {
    id: "portal-cliente",
    title: "Portal do cliente",
    icon: Share2,
    category: "Obra",
    summary:
      "Link público (somente leitura) para o cliente acompanhar o andamento da obra sem precisar de login.",
    steps: [
      "No painel da obra, abra o card do Portal do Cliente.",
      "Gere o link e escolha o que ficará visível.",
      "Envie o link ao cliente; você pode revogar o acesso quando quiser.",
    ],
  },
  {
    id: "tarefas",
    title: "Tarefas (Kanban)",
    icon: KanbanSquare,
    category: "Obra",
    to: "/app/tarefas",
    summary: "Quadro de tarefas por colunas para organizar pendências da equipe e da obra.",
    steps: [
      "Acesse Tarefas no menu.",
      "Crie colunas (ex.: A fazer, Em andamento, Concluído).",
      "Arraste os cards entre colunas, defina responsável, prazo e vincule à obra.",
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: CalendarRange,
    category: "Obra",
    to: "/app/agenda",
    summary: "Calendário de compromissos, visitas técnicas, entregas e marcos por obra.",
    steps: [
      "Acesse Agenda e clique no dia desejado.",
      "Cadastre título, horário, obra vinculada e descrição.",
      "Visualize por mês e filtre por obra.",
    ],
  },

  // --------------------------------------------------------------- Engenharia
  {
    id: "orcamento",
    title: "Orçamento e Etapas",
    icon: ListTree,
    category: "Engenharia",
    summary:
      "Estruture cada obra em Etapas e subetapas. O orçamento é a base do controle de Orçado x Realizado e dos alertas.",
    steps: [
      "Dentro da obra, abra Orçamento.",
      'Crie etapas como "Fundação", "Estrutura", "Acabamento" com valor orçado.',
      "Adicione subetapas para detalhar (ex.: Fundação → Sapatas, Vigas baldrame).",
      "Reordene arrastando pelo ícone à esquerda do card — a numeração acompanha a ordem.",
    ],
    tips: [
      "Toda compra é alocada a uma etapa/subetapa — isso alimenta o Orçado x Realizado automaticamente.",
      "Etapas são numeradas automaticamente pela ordem de criação/organização.",
    ],
  },
  {
    id: "planejamento",
    title: "Planejamento e Gantt",
    icon: CalendarRange,
    category: "Engenharia",
    summary:
      "Organize etapas, prazos e responsáveis pela execução física e acompanhe o cronograma no gráfico de Gantt.",
    steps: [
      "Dentro da obra, acesse Planejamento.",
      "Defina datas de início/fim e responsáveis por etapa.",
      "Abra o Gantt para ver a linha do tempo e o encadeamento das etapas.",
    ],
  },
  {
    id: "rdo",
    title: "RDO — Diário de Obra",
    icon: ClipboardList,
    category: "Engenharia",
    summary:
      "Registro diário do que aconteceu na obra: clima, efetivo, atividades, fotos e ocorrências.",
    steps: [
      "Na obra, acesse RDO e clique em Novo RDO.",
      "Selecione a data e registre clima e condições do dia.",
      "Cadastre a equipe presente classificando cada colaborador como Interna ou Externa.",
      "Descreva as atividades executadas (pode vincular à etapa) e registre ocorrências.",
      "Anexe fotos do dia.",
      "Salve — o RDO fica disponível para impressão em PDF, envio e auditoria.",
    ],
    tips: [
      "As fotos anexadas saem embutidas no PDF do RDO.",
      'No botão "Enviar por WhatsApp": se a obra não tiver número cadastrado, o sistema pede o número e pergunta se deseja salvá-lo como contato principal da obra.',
      "É possível excluir um RDO criado por engano pela lista de RDOs.",
    ],
  },
  {
    id: "medicoes",
    title: "Medições por etapa",
    icon: ClipboardList,
    category: "Engenharia",
    summary:
      "Registre o avanço físico (%) de cada subetapa. As medições alimentam a Curva S do relatório Orçado x Realizado.",
    steps: [
      "Dentro da obra, acesse Medições.",
      "Selecione a subetapa e informe o percentual executado no período.",
      "Salve — o histórico fica disponível e atualiza a Curva S.",
    ],
    tips: ["Combine RDO + Medições para ter avanço físico confiável por dia/semana."],
  },
  {
    id: "rh",
    title: "Colaboradores (RH)",
    icon: Users,
    category: "Engenharia",
    to: "/app/rh/colaboradores",
    summary:
      "Cadastro de colaboradores próprios e terceirizados, disponível na empresa e dentro de cada obra.",
    steps: [
      "Vá em RH → Colaboradores → Novo, ou dentro da obra em RH → Novo Colaborador.",
      "Informe função, CPF, admissão e empresa vinculada.",
      "Dentro da obra é possível visualizar e editar o colaborador sem sair do workspace.",
      "No RDO, ao registrar a equipe, classifique cada colaborador como Interna ou Externa.",
    ],
  },

  // -------------------------------------------------------------- Suprimentos
  {
    id: "compras",
    title: "Compras e Notas Fiscais",
    icon: ShoppingCart,
    category: "Suprimentos",
    summary:
      "Registre compras de material, serviço ou equipamento vinculadas a uma etapa/subetapa, com fornecedor, natureza, itens, NF e geração de contas a pagar.",
    steps: [
      "Dentro da obra, vá em Compras. A árvore de etapas inicia recolhida — expanda a etapa/subetapa desejada.",
      'Clique em "Nova compra" — abre em tela dedicada (sem popup).',
      "Escolha etapa e subetapa (é possível criar uma subetapa nova na hora).",
      "Selecione ou cadastre o fornecedor (o cadastro fica disponível globalmente).",
      "Defina a natureza: Material, Serviço ou Equipamento (usada nos relatórios).",
      "Lance os itens na tabela editável (descrição, quantidade, unidade e valor) ou importe do XML da NF.",
      "Anexe a NF (PDF/XML) na aba de notas fiscais.",
      "Salve. Os campos financeiros são opcionais — a compra pode ficar sem financeiro por enquanto.",
    ],
    tips: [
      "Compras acima do limite configurado entram em fluxo de aprovação.",
      "Compras já faturadas e pagas não aceitam novos itens.",
      'Para excluir uma compra use o botão de excluir: o sistema remove em cascata parcelas, contas a pagar e itens gerados.',
    ],
  },
  {
    id: "gerar-contas-pagar",
    title: "Gerar contas a pagar a partir da compra",
    icon: Receipt,
    category: "Suprimentos",
    summary:
      "Transforme a compra (ou parte dela) em parcelas no Contas a Pagar, com faturamento total ou parcial.",
    steps: [
      "Abra a compra e clique em Gerar contas a pagar.",
      "Informe a quantidade a faturar de cada item (a coluna Qtd. restante mostra o que ainda falta).",
      "Preencha os dados financeiros: data de emissão, meio de pagamento e número de parcelas.",
      "Confirme — as parcelas são criadas automaticamente em Contas a Pagar da obra.",
    ],
    rules: [
      "Se o valor gerado for menor que o total da compra, ela fica como faturamento parcial e permite gerar o restante depois.",
      "Parcelas pagas em cartão entram automaticamente na fatura aberta do cartão.",
    ],
  },
  {
    id: "aprovacao-compras",
    title: "Aprovação de compras (workflow)",
    icon: ShieldCheck,
    category: "Suprimentos",
    summary:
      "Compras acima de um valor configurável entram como 'Pendente de aprovação'. Dono da conta e usuários com papel 'aprovador' podem aprovar ou rejeitar.",
    steps: [
      "Configure o valor mínimo de aprovação nas configurações da conta.",
      "Ao lançar uma compra acima do limite, ela recebe status Pendente e o aprovador é notificado.",
      "O aprovador abre a compra e clica em Aprovar ou Rejeitar (com motivo).",
      "Somente compras aprovadas geram contas a pagar.",
    ],
    tips: ["Badges coloridos (amarelo/verde/vermelho) mostram o status direto na lista."],
  },
  {
    id: "consulta-suprimentos",
    title: "Consulta (Suprimentos)",
    icon: SearchIcon,
    category: "Suprimentos",
    summary:
      "Consulta rápida de preços, fornecedores e histórico de compras da obra para apoiar cotações.",
    steps: [
      "Dentro da obra, acesse Consulta.",
      "Filtre por fornecedor, tipo/natureza, faturamento e período.",
      "Use o resultado como base para novas cotações e negociações.",
    ],
  },
  {
    id: "fornecedores",
    title: "Fornecedores",
    icon: Truck,
    category: "Suprimentos",
    to: "/app/fornecedores",
    summary:
      "Cadastro homologado de fornecedores com dados fiscais, contato e chave PIX. Pode ser criado direto de dentro da obra.",
    steps: [
      "Cadastre fornecedor com CNPJ/CPF, e-mail, telefone e PIX.",
      "Dentro da obra é possível cadastrar no ato do lançamento da compra — ele fica global automaticamente.",
      "Use a lista para consultar histórico de compras por fornecedor.",
    ],
  },
  {
    id: "alertas-orcamento",
    title: "Alertas inteligentes de orçamento (85%)",
    icon: Bell,
    category: "Suprimentos",
    summary:
      "Quando uma etapa atinge 85% do valor orçado, o sistema exibe alerta amarelo. Ao ultrapassar 100%, alerta vermelho.",
    steps: [
      "Cadastre o orçamento por etapa/subetapa.",
      "Ao lançar compras, o realizado é comparado ao orçado em tempo real.",
      "Veja alertas no sino do topo e badges de status nas telas de Orçamento e Compras.",
    ],
  },

  // ---------------------------------------------------------------- Financeiro
  {
    id: "financeiro-regras",
    title: "Como funciona o financeiro (regra principal)",
    icon: Wallet,
    category: "Financeiro",
    summary:
      "Existem dois financeiros: o da Obra (onde os pagamentos da obra são efetivamente feitos) e o da Empresa (consolidado, que enxerga tudo e paga apenas o que não é de obra).",
    steps: [
      "Compras e contas de uma obra são pagas dentro da obra, no Financeiro da obra.",
      "No financeiro da empresa você vê todas as contas, inclusive as das obras, mas as de obra ficam somente leitura com atalho para a obra.",
      "Use o filtro de obra no financeiro da empresa para separar o que é da empresa e o que é de cada obra.",
    ],
    rules: [
      "Pagamento de conta/fatura de obra debita a conta bancária ou cartão da própria obra.",
      "O saldo das contas é atualizado automaticamente pelo sistema a cada baixa, estorno ou transferência.",
    ],
  },
  {
    id: "meios-pagamento",
    title: "Contas bancárias e cartões (meios de pagamento)",
    icon: Landmark,
    category: "Financeiro",
    to: "/app/contas-bancarias",
    summary:
      "Meios de pagamento podem ser Globais (da empresa) ou exclusivos de uma obra. Os selects mostram os globais + os da obra ativa.",
    steps: [
      "Cadastre contas bancárias e cartões antes de lançar pagamentos.",
      "Escolha o vínculo: Global ou uma obra específica.",
      "Dentro da obra, em Financeiro → Meios de pagamento, o cadastro já nasce vinculado àquela obra.",
    ],
    tips: ["Badges nos cards identificam se o meio é Global ou de uma obra específica."],
  },
  {
    id: "categorias",
    title: "Categorias financeiras",
    icon: Tags,
    category: "Financeiro",
    to: "/app/categorias",
    summary: "Árvore de categorias de receita e despesa — base de classificação de todos os relatórios e do DRE.",
    steps: [
      "Acesse Categorias e crie os grupos principais.",
      "Adicione subcategorias dentro de cada grupo.",
      "Use-as ao lançar contas a pagar/receber e movimentações.",
    ],
  },
  {
    id: "contas-pagar",
    title: "Contas a Pagar",
    icon: ArrowDownToLine,
    category: "Financeiro",
    to: "/app/contas-pagar",
    summary:
      "Todas as obrigações: parcelas de compras, faturas de cartão rateadas e despesas avulsas da empresa.",
    steps: [
      "Filtre por status (pendente, pago, vencido) e por obra.",
      'Clique em "Pagar" e informe data, valor e conta/cartão de origem.',
      "A baixa gera o lançamento financeiro e atualiza o saldo da conta automaticamente.",
    ],
    rules: [
      "Contas vinculadas a uma obra só podem ser pagas dentro da obra.",
      "Estornar uma baixa cria um lançamento reverso e devolve o saldo — histórico completo preservado.",
    ],
  },
  {
    id: "contas-receber",
    title: "Contas a Receber",
    icon: Receipt,
    category: "Financeiro",
    to: "/app/contas-receber",
    summary: "Medições faturadas, aportes e recebimentos do cliente, com baixa e conciliação.",
    steps: [
      "Cadastre o título com cliente, valor, vencimento e categoria.",
      "Ao receber, faça a baixa informando a conta bancária de destino.",
      "O saldo da conta é atualizado automaticamente.",
    ],
  },
  {
    id: "cartoes",
    title: "Cartões e Faturas (rateio por obra)",
    icon: CreditCard,
    category: "Financeiro",
    to: "/app/faturas-cartao",
    summary:
      "Cartões corporativos com fechamento mensal. A fatura é rateada por obra: cada obra paga apenas a sua parte; a empresa vê o total consolidado.",
    steps: [
      "Cadastre o cartão informando dia de fechamento e vencimento.",
      "Compras pagas no cartão entram automaticamente na fatura aberta.",
      "No fechamento, o sistema gera uma conta a pagar por obra com o valor das compras daquela obra.",
      "Dentro da obra: pague apenas a parte da obra. Na empresa: acompanhe o total com o detalhamento por obra.",
    ],
    rules: [
      "A fatura só fica com status 'paga' quando todas as obras quitarem a sua parte.",
      "Faturas com compras de obra não podem ser pagas na tela da empresa (aparecem como 'pagamento na obra').",
      "Faturas zeradas (R$ 0,00), resultado de compras excluídas, podem ser removidas na tela de faturas.",
    ],
  },
  {
    id: "caixa-obra",
    title: "Caixa e Bancos da obra",
    icon: Wallet,
    category: "Financeiro",
    summary:
      "Extrato da obra: aportes recebidos, pagamentos realizados, estornos e saldo atual de cada conta vinculada.",
    steps: [
      "Dentro da obra, acesse Caixa e Bancos.",
      "Registre aportes (entradas) e acompanhe as saídas geradas pelas baixas.",
      "Use o estorno para reverter um pagamento — a compra volta a ficar pendente e o valor retorna ao saldo.",
    ],
    tips: ["O saldo é sempre calculado pelos lançamentos; não há ajuste manual."],
  },
  {
    id: "estorno",
    title: "Estornos",
    icon: Undo2,
    category: "Financeiro",
    summary:
      "Todo pagamento pode ser revertido sem apagar histórico: o sistema cria um lançamento contrário.",
    steps: [
      "Localize o pagamento em Contas a Pagar/Receber ou no Caixa e Bancos da obra.",
      "Clique em Estornar e confirme.",
      "A conta volta a pendente, o lançamento reverso é criado e o saldo é devolvido.",
    ],
  },
  {
    id: "transferencias",
    title: "Transferências entre contas",
    icon: ArrowLeftRight,
    category: "Financeiro",
    to: "/app/transferencias",
    summary: "Movimente valores entre contas bancárias/caixas mantendo os saldos corretos dos dois lados.",
    steps: [
      "Acesse Transferências → Nova.",
      "Escolha conta de origem, conta de destino, valor e data.",
      "Confirme — o sistema gera a saída e a entrada correspondentes.",
    ],
  },
  {
    id: "conciliacao",
    title: "Conciliação bancária",
    icon: CheckCircle2,
    category: "Financeiro",
    to: "/app/conciliacao",
    summary: "Compare o extrato do banco com os lançamentos do sistema e marque o que já bateu.",
    steps: [
      "Importe/lance o extrato do período.",
      "O sistema sugere correspondências com os lançamentos existentes.",
      "Confirme as correspondências e trate as divergências.",
    ],
  },
  {
    id: "fluxo-caixa",
    title: "Fluxo de caixa",
    icon: BarChart3,
    category: "Financeiro",
    to: "/app/fluxo-caixa",
    summary: "Projeção de entradas e saídas nos próximos meses, considerando contas a pagar e a receber em aberto.",
    steps: [
      "Acesse Fluxo de Caixa.",
      "Escolha o período e, se quiser, a obra.",
      "Analise saldo projetado por mês para antecipar necessidade de aporte.",
    ],
  },

  // ---------------------------------------------------------------- Relatórios
  {
    id: "relatorios-obra",
    title: "Relatórios da obra",
    icon: LineChart,
    category: "Relatórios",
    summary:
      "Cada obra tem seus relatórios: Compras, Pagamentos e Orçado x Realizado (com Curva S: planejado × físico × financeiro).",
    steps: [
      "Dentro da obra, abra Relatórios e escolha o relatório desejado.",
      "Compras: filtre por fornecedor, etapa, NF e período. Exporte PDF, Excel ou envie por WhatsApp (modal para digitar o número, envia o PDF em anexo).",
      "Pagamentos: filtre por fornecedor, forma de pagamento, status, natureza, NF e tipo de data (vencimento ou pagamento). Exporte PDF ou Excel.",
      "Orçado x Realizado: compare por etapa e subetapa e veja a Curva S.",
    ],
  },
  {
    id: "relatorios",
    title: "Relatórios consolidados da empresa",
    icon: FileBarChart2,
    category: "Relatórios",
    to: "/app/relatorios",
    summary:
      "Visão multi-obra: financeiro consolidado, Orçado x Realizado por obra/etapa/subetapa, DRE e exportações.",
    steps: [
      "Filtre por período e, se quiser, por uma obra específica.",
      "Em Orçado x Realizado, expanda a etapa para ver o detalhe das subetapas e o desvio percentual.",
      "Exporte em CSV (formatado para Excel pt-BR) ou PDF.",
    ],
  },
  {
    id: "exportacoes",
    title: "Exportações (PDF, Excel e WhatsApp)",
    icon: FileSpreadsheet,
    category: "Relatórios",
    summary: "Praticamente todo relatório pode sair em PDF ou Excel; o de compras também vai por WhatsApp.",
    steps: [
      "Aplique os filtros desejados antes de exportar — a exportação respeita o que está na tela.",
      "PDF: layout pronto para impressão/envio ao cliente.",
      "Excel/CSV: formatado em pt-BR para abrir direto no Excel.",
    ],
  },
  {
    id: "notificacoes",
    title: "Notificações (sino)",
    icon: Bell,
    category: "Relatórios",
    summary:
      "O sino agrupa alertas operacionais em tempo real: contas vencendo, faturas fechando, obras sem RDO e estouro de orçamento.",
    steps: [
      "Clique no sino no topo para abrir o painel.",
      "Contas a pagar com vencimento em até 3 dias ou em atraso.",
      "Faturas de cartão fechando em até 3 dias.",
      "Obras ativas sem RDO há 7 dias ou mais.",
      "Etapas com 85% ou mais do orçamento consumido.",
    ],
    tips: ["Os alertas são calculados em tempo real — não é preciso configurar nada."],
  },

  // ------------------------------------------------------------ Conta e acesso
  {
    id: "usuarios",
    title: "Usuários e permissões",
    icon: UserCog,
    category: "Conta e acesso",
    to: "/app/configuracoes/usuarios",
    summary:
      "Convide sua equipe e defina o que cada um pode fazer, incluindo quem pode aprovar compras.",
    steps: [
      "Acesse Configurações → Usuários.",
      "Clique em Convidar e informe o e-mail — a pessoa recebe um link de convite.",
      "Defina o papel (ex.: aprovador) e as obras que ela pode acessar.",
      "Remova o acesso a qualquer momento.",
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações da conta",
    icon: ShieldCheck,
    category: "Conta e acesso",
    to: "/app/configuracoes",
    summary:
      "Preferências gerais: dados da conta, limite de aprovação de compras, integrações e notificações.",
    steps: [
      "Acesse Configurações no menu.",
      "Defina o valor mínimo que exige aprovação de compra.",
      "Revise integrações e preferências de envio (e-mail/WhatsApp).",
    ],
  },
  {
    id: "perfil",
    title: "Perfil e segurança",
    icon: Users,
    category: "Conta e acesso",
    to: "/app/perfil",
    summary: "Seus dados pessoais, foto, e-mail de acesso e troca de senha.",
    steps: [
      "Abra seu avatar no topo → Perfil.",
      "Atualize nome, telefone e foto.",
      "Use Alterar senha para trocar a credencial de acesso.",
    ],
  },
  {
    id: "assistente-ia",
    title: "Assistente de IA",
    icon: Bot,
    category: "Conta e acesso",
    summary: "Tire dúvidas sobre a plataforma e peça análises rápidas dos seus dados sem sair do sistema.",
    steps: [
      "Clique no botão do assistente (canto da tela).",
      "Descreva sua dúvida ou o que quer analisar.",
      "Cada interação consome créditos da conta.",
    ],
  },
  {
    id: "creditos",
    title: "Créditos",
    icon: Coins,
    category: "Conta e acesso",
    to: "/app/creditos",
    summary: "Saldo usado por recursos que consomem processamento, como o assistente de IA e envios.",
    steps: [
      "Acompanhe o saldo no badge da barra superior.",
      "Em Créditos, veja o extrato de consumo e recargas.",
      "Faça recarga quando necessário.",
    ],
  },
  {
    id: "assinatura",
    title: "Assinatura e Planos",
    icon: Sparkles,
    category: "Conta e acesso",
    to: "/app/assinatura",
    summary: "Gestão do seu plano, faturas e módulos liberados.",
    steps: [
      "Visualize o plano atual e o que está incluso.",
      "Consulte e baixe as faturas emitidas.",
      "Faça upgrade/downgrade quando precisar de mais usuários ou módulos.",
    ],
  },
  {
    id: "suporte",
    title: "Suporte e novidades",
    icon: LifeBuoy,
    category: "Conta e acesso",
    summary: "Abra chamados para o time de suporte e acompanhe o histórico de atualizações do sistema.",
    steps: [
      "Use o canal de suporte para abrir um chamado descrevendo o problema.",
      "Acompanhe as respostas dentro do próprio chamado.",
      "Consulte as novidades de cada versão no changelog.",
    ],
  },
];

const FIRST_STEPS = [
  { label: "Cadastrar sua empresa", to: "/app/empresas", icon: Building2 },
  { label: "Definir categorias financeiras", to: "/app/categorias", icon: Tags },
  { label: "Configurar contas bancárias e cartões", to: "/app/contas-bancarias", icon: Wallet },
  { label: "Cadastrar fornecedores", to: "/app/fornecedores", icon: Truck },
  { label: "Cadastrar colaboradores", to: "/app/rh/colaboradores", icon: Users },
  { label: "Criar a primeira obra e o orçamento", to: "/app/obras", icon: HardHat },
];

function ManualPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "Todos">("Todos");
  const { user } = useAuth();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return SECTIONS.filter((s) => {
      if (cat !== "Todos" && s.category !== cat) return false;
      if (!term) return true;
      return (
        s.title.toLowerCase().includes(term) ||
        s.summary.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.steps.some((st) => st.toLowerCase().includes(term)) ||
        (s.tips ?? []).some((t) => t.toLowerCase().includes(term)) ||
        (s.rules ?? []).some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [q, cat]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Manual da plataforma"
        description="Documentação completa do Mestre 360: passo a passo, regras de negócio e dicas de cada módulo."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" /> Primeiros passos recomendados
            </CardTitle>
            <CardDescription>
              Faça esses cadastros nesta ordem para liberar todos os fluxos da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {FIRST_STEPS.map((s, i) => (
                <li key={s.to}>
                  <Link
                    to={s.to}
                    className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm transition hover:bg-secondary"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{s.label}</span>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" /> Tour guiado
            </CardTitle>
            <CardDescription>
              Refaça o passo a passo interativo de primeiro acesso a qualquer momento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => startOnboardingTour(user?.id, { force: true })}>
              <PlayCircle className="mr-2 h-4 w-4" /> Iniciar tour guiado
            </Button>
            <div className="flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <p>
                Suas configurações e dados não são alterados pelo tour — ele apenas mostra onde
                cada coisa fica.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Documentação por módulo</CardTitle>
              <CardDescription>
                Clique em cada seção para ver o passo a passo. {SECTIONS.length} tópicos documentados.
              </CardDescription>
            </div>
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar no manual..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            {(["Todos", ...CATEGORIES] as const).map((c) => (
              <Button
                key={c}
                size="sm"
                variant={cat === c ? "default" : "outline"}
                onClick={() => setCat(c as Category | "Todos")}
              >
                {c}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum tópico encontrado para "{q}".
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {filtered.map((s) => (
                <AccordionItem key={s.id} value={s.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          {s.title}
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {s.category}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">{s.summary}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pl-11 pt-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Passo a passo
                      </p>
                      <ol className="ml-4 list-decimal space-y-1.5 text-sm">
                        {s.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    {s.rules && s.rules.length > 0 ? (
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                          <ShieldCheck className="h-3 w-3" /> Regras importantes
                        </p>
                        <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
                          {s.rules.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {s.tips && s.tips.length > 0 ? (
                      <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                          <Lightbulb className="h-3 w-3" /> Dicas
                        </p>
                        <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
                          {s.tips.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {s.to ? (
                      <Link to={s.to}>
                        <Button variant="outline" size="sm">
                          Abrir módulo
                        </Button>
                      </Link>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atalhos úteis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span>Busca global</span>
            <Badge variant="outline">Ctrl + K</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span>Trocar obra ativa</span>
            <span className="text-xs text-muted-foreground">Seletor no topo</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span>Notificações e alertas</span>
            <span className="text-xs text-muted-foreground">Sino no topo</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span>Entrar no workspace da obra</span>
            <span className="text-xs text-muted-foreground">Obras → Abrir obra</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
