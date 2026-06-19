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
  Package,
  Warehouse,
  ArrowUpDown,
  ClipboardCheck,
  Truck,
  Users,
  CreditCard,
  Wallet,
  Receipt,
  ArrowDownToLine,
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

type Section = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  to?: string;
  summary: string;
  steps: string[];
  tips?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "empresas",
    title: "Empresas",
    icon: Building2,
    to: "/app/empresas",
    summary:
      "Cadastre a(s) empresa(s) responsáveis pelas obras. Todos os documentos (notas, contratos, financeiro) ficam vinculados a uma empresa.",
    steps: [
      "Acesse Empresas no menu lateral.",
      'Clique em "Nova empresa" e preencha razão social, CNPJ, endereço e contatos.',
      "Defina a empresa padrão caso você opere mais de uma — ela será pré-selecionada nos novos cadastros.",
    ],
    tips: ["Você pode editar dados fiscais a qualquer momento — eles refletem em relatórios e notas futuras."],
  },
  {
    id: "obras",
    title: "Obras",
    icon: HardHat,
    to: "/app/obras",
    summary:
      "A obra é o centro de tudo: orçamento, compras, RDOs, medições e relatórios são organizados por obra.",
    steps: [
      'Vá em Obras → "Nova obra".',
      "Informe nome, endereço, datas de início/previsão e a empresa responsável.",
      "Use o seletor de Obra Ativa na barra superior para focar o trabalho do dia em uma obra específica.",
    ],
    tips: [
      "Você pode acompanhar o cronograma físico no Gantt (atalho no topo de cada obra).",
      "A obra ativa filtra automaticamente compras, RDO e relatórios.",
    ],
  },
  {
    id: "workspace-obra",
    title: "Workspace dedicado da obra",
    icon: HardHat,
    summary:
      "Ao abrir uma obra, a sidebar muda para o contexto dela: você só vê os módulos daquela obra (Visão, Planejamento, RDO, Compras, Consulta, Fornecedores, Caixa, Faturas, Contas a Pagar, Pagamentos, RH e Relatórios).",
    steps: [
      'Em Obras, clique em "Abrir obra" no card desejado.',
      "A barra lateral passa a mostrar apenas os módulos daquela obra; o breadcrumb no topo mostra Empresa › Obra › Seção.",
      'Use o atalho "Última obra" na barra superior para voltar rapidamente ao último projeto acessado.',
      "Para sair do workspace, use o botão Voltar ou navegue por Obras no topo.",
    ],
    tips: [
      "O atalho da última obra fica salvo localmente — útil para retomar o trabalho do dia.",
      "Tudo dentro do workspace já vem filtrado pela obra: você não precisa reaplicar filtros.",
    ],
  },
  {
    id: "planejamento",
    title: "Planejamento (Engenharia)",
    icon: CalendarRange,
    summary:
      "Tela de planejamento dentro da obra para organizar etapas, prazos e responsáveis pela execução física.",
    steps: [
      "Dentro da obra, acesse Planejamento.",
      "Defina marcos, datas-alvo e responsáveis por etapa.",
      "Acompanhe o avanço junto com Medições e RDO.",
    ],
  },
  {
    id: "medicoes",
    title: "Medições por etapa",
    icon: ClipboardList,
    summary:
      "Registre o avanço físico (%) de cada subetapa da obra. As medições alimentam a Curva S no relatório Orçado x Realizado.",
    steps: [
      "Dentro da obra, acesse Medições.",
      "Selecione a subetapa e informe o percentual executado no período.",
      "Salve — o histórico fica disponível e atualiza automaticamente a Curva S.",
    ],
    tips: ["Combine RDO + Medições para ter avanço físico confiável por dia/semana."],
  },
  {
    id: "consulta-suprimentos",
    title: "Consulta (Suprimentos)",
    icon: SearchIcon,
    summary:
      "Consulta rápida de preços, fornecedores e histórico de compras da obra para apoiar cotações.",
    steps: [
      "Dentro da obra, acesse Consulta.",
      "Pesquise por produto, fornecedor ou período.",
      "Use o resultado como base para novas cotações e compras.",
    ],
  },
  {
    id: "relatorios-obra",
    title: "Relatórios por obra",
    icon: LineChart,
    summary:
      "Cada obra tem seus próprios relatórios: Compras, Pagamentos e Orçado x Realizado — esse último agora com Curva S (planejado vs físico vs financeiro).",
    steps: [
      "Dentro da obra, abra Relatórios e escolha Compras, Pagamentos ou Orçado x Realizado.",
      "Filtre por período e etapa.",
      "Na Curva S, compare a linha de planejado, físico (medições) e financeiro (compras).",
    ],
  },
  {
    id: "notificacoes",
    title: "Notificações no sino",
    icon: Bell,
    summary:
      "O sino na barra superior agrupa alertas operacionais: contas a pagar vencendo, faturas de cartão fechando e obras sem RDO recente.",
    steps: [
      "Clique no sino no topo para abrir o painel.",
      "Veja contas a pagar com vencimento em até 3 dias (ou em atraso).",
      "Veja faturas de cartão fechando em até 3 dias.",
      "Veja obras ativas sem RDO há 7 dias ou mais.",
    ],
    tips: ["Os alertas são calculados em tempo real — não é preciso configurar nada."],
  {
    id: "orcamento",
    title: "Orçamento e Etapas",
    icon: ListTree,
    summary:
      "Estruture cada obra em Etapas (e subetapas). O orçamento é a base do controle de Orçado x Realizado.",
    steps: [
      "Dentro da obra, abra Orçamento.",
      'Crie etapas como "Fundação", "Estrutura", "Acabamento" com valor orçado.',
      "Adicione subetapas para detalhar (ex.: Fundação → Sapatas, Vigas baldrame).",
      "Reordene arrastando pelo ícone à esquerda do card.",
    ],
    tips: [
      "Toda compra é alocada a uma etapa — isso alimenta o relatório Orçado x Realizado automaticamente.",
    ],
  },
  {
    id: "rdo",
    title: "RDO — Diário de Obra",
    icon: ClipboardList,
    summary:
      "Registro diário do que aconteceu na obra: efetivo, clima, atividades, fotos e ocorrências.",
    steps: [
      "Na obra, acesse RDO e clique em Novo RDO.",
      "Selecione a data, registre clima, efetivo presente, atividades executadas e anexe fotos.",
      "Salve — o RDO fica disponível para impressão, envio e auditoria.",
    ],
    tips: ["Use o RDO no celular para preenchimento em campo."],
  },
  {
    id: "compras",
    title: "Compras e Notas Fiscais",
    icon: ShoppingCart,
    summary:
      "Registre toda compra de material/serviço vinculada a uma etapa da obra, com fornecedor, parcelas e NF.",
    steps: [
      "Dentro da obra, vá em Compras → Nova compra.",
      "Escolha fornecedor, etapa/subetapa, itens, valor e forma de pagamento (à vista, parcelado, cartão).",
      "Anexe a NF (PDF/XML) e suas parcelas viram contas a pagar automaticamente.",
    ],
    tips: [
      "Parcelas no cartão entram na fatura do cartão.",
      'Use "Medições" quando o serviço é faturado em etapas (ex.: empreitada).',
    ],
  },
  {
    id: "estoque",
    title: "Estoque, Produtos e Requisições",
    icon: Package,
    summary:
      "Controle o que entra, sai e está em cada almoxarifado, e atenda requisições da obra.",
    steps: [
      "Cadastre Produtos (insumos), unidades e estoque mínimo.",
      "Crie Almoxarifados (ex.: Central, Obra X).",
      "Registre Movimentações de entrada/saída/transferência.",
      "Atenda Requisições feitas pelo mestre de obra.",
    ],
  },
  {
    id: "fornecedores",
    title: "Fornecedores",
    icon: Truck,
    to: "/app/fornecedores",
    summary: "Cadastro homologado de fornecedores com dados fiscais, contato e chave PIX.",
    steps: [
      "Cadastre fornecedor com CNPJ/CPF, e-mail, telefone e PIX.",
      "Use o filtro por categoria para encontrar rapidamente nas compras.",
    ],
  },
  {
    id: "rh",
    title: "Colaboradores (RH)",
    icon: Users,
    to: "/app/rh/colaboradores",
    summary: "Cadastro de colaboradores próprios e terceirizados utilizados no RDO e folha.",
    steps: ["Vá em RH → Colaboradores → Novo.", "Informe função, CPF, admissão e empresa vinculada."],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: Wallet,
    summary:
      "Controle bancos, cartões, categorias, contas a pagar/receber e transferências entre contas.",
    steps: [
      "Cadastre Contas bancárias e Cartões antes de lançar pagamentos.",
      "Crie a árvore de Categorias (despesa/receita) — base de todos os relatórios.",
      "Use Contas a Pagar/Receber para o dia a dia; baixe (pague) e o saldo da conta é atualizado.",
      "Concilie o extrato bancário em Conciliação.",
    ],
    tips: [
      "Estornar um pagamento gera um lançamento reverso e devolve o saldo na conta — auditoria completa.",
      "O Fluxo de Caixa projeta entradas e saídas pelos próximos meses.",
    ],
  },
  {
    id: "cartoes",
    title: "Cartões e Faturas",
    icon: CreditCard,
    summary: "Cartões corporativos com fechamento mensal e fatura para pagamento.",
    steps: [
      "Cadastre o cartão informando dia de fechamento e vencimento.",
      "Compras pagas no cartão entram automaticamente na fatura aberta.",
      'Em "Faturas de cartão" você fecha e paga a fatura.',
    ],
  },
  {
    id: "relatorios",
    title: "Relatórios",
    icon: FileBarChart2,
    to: "/app/relatorios",
    summary:
      "Consolidados financeiros, Orçado x Realizado por obra/etapa, DRE e exportações CSV/PDF.",
    steps: [
      "Filtre por obra e período.",
      "Compare Orçado x Realizado por etapa e veja desvio percentual.",
      "Exporte em CSV (formatado para Excel pt-BR) ou PDF.",
    ],
  },
  {
    id: "assinatura",
    title: "Assinatura e Planos",
    icon: Sparkles,
    to: "/app/assinatura",
    summary: "Gestão do seu plano, faturas e módulos liberados.",
    steps: [
      "Visualize o plano atual e o que está incluso.",
      "Faça upgrade/downgrade quando precisar de mais usuários ou módulos.",
    ],
  },
];

const FIRST_STEPS = [
  { label: "Cadastrar sua empresa", to: "/app/empresas", icon: Building2 },
  { label: "Criar a primeira obra", to: "/app/obras", icon: HardHat },
  { label: "Configurar contas bancárias", to: "/app/contas-bancarias", icon: Wallet },
  { label: "Definir categorias financeiras", to: "/app/categorias", icon: Tags },
  { label: "Cadastrar fornecedores", to: "/app/fornecedores", icon: Truck },
];

function ManualPage() {
  const [q, setQ] = useState("");
  const { user } = useAuth();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return SECTIONS;
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.summary.toLowerCase().includes(term) ||
        s.steps.some((st) => st.toLowerCase().includes(term)),
    );
  }, [q]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Manual da plataforma"
        description="Aprenda a usar cada módulo do Mestre 360 e configure tudo na ordem certa."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" /> Primeiros passos recomendados
            </CardTitle>
            <CardDescription>
              Faça esses cadastros iniciais para liberar todos os fluxos da plataforma.
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Documentação por módulo</CardTitle>
              <CardDescription>
                Clique em cada seção para ver o passo a passo. {SECTIONS.length} módulos documentados.
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
                        <p className="font-medium">{s.title}</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
