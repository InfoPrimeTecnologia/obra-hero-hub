import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyCreditDelta, getActionCost, getBalance } from "./credits.functions";

async function chargeCredits(
  supabase: any,
  customerId: string,
  userId: string,
  actionKey: string,
  descricao: string,
): Promise<{ charged: number; saldo: number }> {
  const cost = await getActionCost(supabase, actionKey);
  if (cost <= 0) return { charged: 0, saldo: await getBalance(supabase, customerId) };
  const balance = await getBalance(supabase, customerId);
  if (balance < cost) {
    const err: any = new Error(
      `Créditos insuficientes. Necessário: ${cost}, disponível: ${balance}. Acesse /app/creditos para recarregar.`,
    );
    err.code = "INSUFFICIENT_CREDITS";
    err.needed = cost;
    err.balance = balance;
    throw err;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const res = await applyCreditDelta(supabaseAdmin, {
    customerId,
    delta: -cost,
    tipo: "consumo",
    actionKey,
    descricao,
    userId,
  });
  return { charged: cost, saldo: res.saldo };
}

const OPENAI_URL = "https://api.openai.com/v1";
const MODEL = "gpt-4o-mini";

// ---------- Tool catalog (OpenAI function calling) ----------
const T = (name: string, description: string, properties: any, required: string[] = []) => ({
  type: "function" as const,
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  },
});

const TOOLS = [
  // ===== Obras =====
  T("list_obras", "Lista as obras do usuário (id, nome, status).", {
    incluir_arquivadas: { type: "boolean" },
  }),
  T("get_obra_resumo", "Retorna resumo de uma obra: orçamento total, realizado, % concluído, etapas.", {
    obra_nome: { type: "string" },
  }, ["obra_nome"]),
  T("create_obra", "Cria uma nova obra.", {
    nome: { type: "string" },
    descricao: { type: "string" },
    cidade: { type: "string" },
    estado: { type: "string", description: "UF, 2 letras" },
    contato_nome: { type: "string" },
    contato_whatsapp: { type: "string" },
  }, ["nome"]),
  T("update_obra", "Atualiza dados de uma obra existente.", {
    obra_nome: { type: "string" },
    novo_nome: { type: "string" },
    descricao: { type: "string" },
    cidade: { type: "string" },
    estado: { type: "string" },
    contato_nome: { type: "string" },
    contato_whatsapp: { type: "string" },
    start_date: { type: "string", description: "YYYY-MM-DD" },
    expected_end_date: { type: "string" },
  }, ["obra_nome"]),
  T("archive_obra", "Arquiva ou reativa uma obra.", {
    obra_nome: { type: "string" },
    arquivar: { type: "boolean", description: "true=arquivar, false=reativar" },
  }, ["obra_nome", "arquivar"]),

  // ===== Orçamento =====
  T("list_etapas", "Lista etapas e subetapas de uma obra (com valores e percentual).", {
    obra_nome: { type: "string" },
  }, ["obra_nome"]),
  T("create_etapa", "Cria uma nova etapa de orçamento dentro de uma obra.", {
    obra_nome: { type: "string" },
    nome: { type: "string" },
  }, ["obra_nome", "nome"]),
  T("create_subetapa", "Cria uma subetapa (item de orçamento) dentro de uma etapa.", {
    obra_nome: { type: "string" },
    etapa_nome: { type: "string" },
    nome: { type: "string" },
    valor_orcado: { type: "number" },
  }, ["obra_nome", "etapa_nome", "nome", "valor_orcado"]),
  T("update_subetapa", "Atualiza valor orçado ou percentual de uma subetapa.", {
    obra_nome: { type: "string" },
    etapa_nome: { type: "string" },
    subetapa_nome: { type: "string" },
    novo_valor: { type: "number" },
    percentual: { type: "number", description: "0-100" },
  }, ["obra_nome", "etapa_nome", "subetapa_nome"]),
  T("delete_etapa", "Exclui uma etapa de orçamento (e suas subetapas).", {
    obra_nome: { type: "string" },
    etapa_nome: { type: "string" },
  }, ["obra_nome", "etapa_nome"]),
  T("delete_subetapa", "Exclui uma subetapa.", {
    obra_nome: { type: "string" },
    etapa_nome: { type: "string" },
    subetapa_nome: { type: "string" },
  }, ["obra_nome", "etapa_nome", "subetapa_nome"]),

  // ===== Compras =====
  T("list_compras", "Lista compras com filtros opcionais.", {
    obra_nome: { type: "string" },
    fornecedor_nome: { type: "string" },
    desde: { type: "string", description: "YYYY-MM-DD" },
    ate: { type: "string", description: "YYYY-MM-DD" },
    limit: { type: "integer", description: "default 20" },
  }),
  T("get_compra", "Detalhes de uma compra (itens, parcelas, recebimentos).", {
    compra_id: { type: "string", description: "UUID da compra" },
  }, ["compra_id"]),
  T("create_compra", "Registra uma compra para uma obra. SEMPRE exige etapa e subetapa do orçamento — pergunte ao usuário antes de chamar se não souber.", {
    obra_nome: { type: "string" },
    etapa_nome: { type: "string", description: "Nome da etapa do orçamento da obra (obrigatório)" },
    subetapa_nome: { type: "string", description: "Nome da subetapa dentro da etapa (obrigatório)" },
    fornecedor_nome: { type: "string" },
    descricao: { type: "string" },
    valor_total: { type: "number" },
    forma_pagamento: { type: "string", enum: ["dinheiro", "pix", "boleto", "cartao", "transferencia"] },
    qtd_parcelas: { type: "integer", minimum: 1 },
    data_compra: { type: "string", description: "YYYY-MM-DD; default hoje" },
  }, ["obra_nome", "etapa_nome", "subetapa_nome", "descricao", "valor_total", "forma_pagamento"]),
  T("cancel_compra", "Cancela uma compra (status=cancelada).", {
    compra_id: { type: "string" },
  }, ["compra_id"]),

  // ===== RDO =====
  T("create_rdo", "Cria um Diário de Obra (RDO).", {
    obra_nome: { type: "string" },
    data: { type: "string", description: "YYYY-MM-DD; default hoje" },
    condicao: { type: "string", enum: ["trabalhada", "parcial", "parada"] },
    clima: { type: "string" },
    atividade: { type: "string" },
    observacoes: { type: "string" },
  }, ["obra_nome", "condicao"]),
  T("add_rdo_equipe", "Adiciona equipe ao RDO mais recente da obra (ou de uma data).", {
    obra_nome: { type: "string" },
    data: { type: "string", description: "YYYY-MM-DD; default último RDO" },
    funcao: { type: "string", description: "Ex.: pedreiro, servente" },
    quantidade: { type: "integer" },
    horas: { type: "number" },
    empreiteiro: { type: "string" },
  }, ["obra_nome", "funcao", "quantidade", "horas"]),
  T("add_rdo_atividade", "Adiciona atividade ao RDO mais recente da obra (ou de uma data).", {
    obra_nome: { type: "string" },
    data: { type: "string" },
    descricao: { type: "string" },
    percentual: { type: "number" },
  }, ["obra_nome", "descricao"]),
  T("add_rdo_ocorrencia", "Adiciona ocorrência ao RDO (acidente, atraso, etc.).", {
    obra_nome: { type: "string" },
    data: { type: "string" },
    tipo: { type: "string", description: "Ex.: chuva, acidente, atraso, visita" },
    descricao: { type: "string" },
  }, ["obra_nome", "tipo", "descricao"]),

  // ===== Contas a Pagar / Receber =====
  T("list_contas_pagar", "Lista contas a pagar.", {
    status: { type: "string", enum: ["pendente", "pago", "atrasada"] },
    obra_nome: { type: "string" },
    desde: { type: "string" },
    ate: { type: "string" },
    limit: { type: "integer" },
  }),
  T("list_contas_receber", "Lista contas a receber.", {
    status: { type: "string", enum: ["pendente", "recebido", "atrasada"] },
    obra_nome: { type: "string" },
    desde: { type: "string" },
    ate: { type: "string" },
    limit: { type: "integer" },
  }),
  T("create_conta_pagar", "Cria uma conta a pagar (despesa).", {
    descricao: { type: "string" },
    valor: { type: "number" },
    vencimento: { type: "string", description: "YYYY-MM-DD" },
    obra_nome: { type: "string" },
    fornecedor_nome: { type: "string" },
    categoria_nome: { type: "string" },
  }, ["descricao", "valor", "vencimento"]),
  T("create_conta_receber", "Cria uma conta a receber (receita).", {
    descricao: { type: "string" },
    valor: { type: "number" },
    vencimento: { type: "string" },
    obra_nome: { type: "string" },
    categoria_nome: { type: "string" },
  }, ["descricao", "valor", "vencimento"]),
  T("pagar_conta", "Dá baixa em uma conta a pagar (status=pago).", {
    descricao_busca: { type: "string", description: "Texto para localizar a conta a pagar" },
    conta_bancaria_nome: { type: "string" },
    data_pagamento: { type: "string", description: "YYYY-MM-DD; default hoje" },
    valor_pago: { type: "number", description: "Opcional; default valor da conta" },
  }, ["descricao_busca", "conta_bancaria_nome"]),
  T("receber_conta", "Dá baixa em uma conta a receber (status=recebido).", {
    descricao_busca: { type: "string" },
    conta_bancaria_nome: { type: "string" },
    data_recebimento: { type: "string" },
    valor_recebido: { type: "number" },
  }, ["descricao_busca", "conta_bancaria_nome"]),

  // ===== Bancos / Lançamentos =====
  T("list_contas_bancarias", "Lista contas bancárias com saldo atual.", {}),
  T("create_conta_bancaria", "Cria uma conta bancária.", {
    nome: { type: "string" },
    banco: { type: "string" },
    agencia: { type: "string" },
    conta: { type: "string" },
    tipo: { type: "string", enum: ["corrente", "poupanca", "caixa", "investimento"] },
    saldo_inicial: { type: "number" },
  }, ["nome", "tipo"]),
  T("create_transferencia", "Transfere valor entre duas contas bancárias.", {
    conta_origem_nome: { type: "string" },
    conta_destino_nome: { type: "string" },
    valor: { type: "number" },
    data: { type: "string", description: "YYYY-MM-DD; default hoje" },
    descricao: { type: "string" },
  }, ["conta_origem_nome", "conta_destino_nome", "valor"]),
  T("list_lancamentos", "Extrato de lançamentos com filtros.", {
    conta_bancaria_nome: { type: "string" },
    desde: { type: "string" },
    ate: { type: "string" },
    tipo: { type: "string", enum: ["entrada", "saida"] },
    limit: { type: "integer" },
  }),

  // ===== Cartões =====
  T("list_cartoes", "Lista cartões de crédito cadastrados.", {}),
  T("create_cartao", "Cria um cartão de crédito.", {
    nome: { type: "string" },
    bandeira: { type: "string" },
    ultimos_4: { type: "string" },
    limite: { type: "number" },
    dia_fechamento: { type: "integer", description: "1-31" },
    dia_vencimento: { type: "integer", description: "1-31" },
  }, ["nome", "limite", "dia_fechamento", "dia_vencimento"]),
  T("list_faturas_cartao", "Lista faturas de cartão.", {
    cartao_nome: { type: "string" },
    status: { type: "string", enum: ["aberta", "fechada", "paga"] },
  }),
  T("pagar_fatura_cartao", "Fecha e/ou marca como paga uma fatura de cartão.", {
    cartao_nome: { type: "string" },
    competencia: { type: "string", description: "YYYY-MM (ex.: 2026-07)" },
    conta_bancaria_nome: { type: "string" },
    data_pagamento: { type: "string" },
  }, ["cartao_nome", "competencia"]),

  // ===== Fornecedores =====
  T("list_fornecedores", "Lista fornecedores (busca opcional por nome).", {
    busca: { type: "string" },
  }),
  T("create_fornecedor", "Cria um fornecedor.", {
    nome: { type: "string" },
    cpf_cnpj: { type: "string" },
    email: { type: "string" },
    telefone: { type: "string" },
    contato: { type: "string" },
  }, ["nome"]),
  T("update_fornecedor", "Atualiza dados de um fornecedor existente.", {
    nome_busca: { type: "string" },
    novo_nome: { type: "string" },
    cpf_cnpj: { type: "string" },
    email: { type: "string" },
    telefone: { type: "string" },
    contato: { type: "string" },
  }, ["nome_busca"]),

  // ===== Categorias =====
  T("list_categorias", "Lista categorias financeiras.", {
    tipo: { type: "string", enum: ["despesa", "receita"] },
  }),
  T("create_categoria", "Cria uma categoria financeira (despesa ou receita).", {
    nome: { type: "string" },
    tipo: { type: "string", enum: ["despesa", "receita"] },
  }, ["nome", "tipo"]),

  // ===== Empresas =====
  T("list_empresas", "Lista empresas (filiais/CNPJ) do cliente.", {}),
  T("create_empresa", "Cria uma empresa (filial/CNPJ).", {
    nome: { type: "string" },
    cnpj: { type: "string" },
  }, ["nome"]),

  // ===== Estoque =====
  T("list_produtos", "Lista produtos (busca opcional).", {
    busca: { type: "string" },
    limit: { type: "integer" },
  }),
  T("create_produto", "Cria um produto.", {
    nome: { type: "string" },
    unidade: { type: "string", description: "Ex.: un, kg, m, m2, sc" },
    codigo: { type: "string" },
    categoria: { type: "string" },
    estoque_minimo: { type: "number" },
  }, ["nome", "unidade"]),
  T("list_almoxarifados", "Lista almoxarifados.", {
    obra_nome: { type: "string" },
  }),
  T("create_almoxarifado", "Cria um almoxarifado.", {
    nome: { type: "string" },
    obra_nome: { type: "string", description: "Opcional; almoxarifado da obra" },
    principal: { type: "boolean" },
  }, ["nome"]),
  T("movimentar_estoque", "Movimenta estoque: entrada, saída ou ajuste.", {
    produto_nome: { type: "string" },
    almoxarifado_nome: { type: "string" },
    tipo: { type: "string", enum: ["entrada", "saida", "ajuste"] },
    quantidade: { type: "number" },
    custo_unitario: { type: "number" },
    observacoes: { type: "string" },
    data: { type: "string", description: "YYYY-MM-DD; default hoje" },
  }, ["produto_nome", "almoxarifado_nome", "tipo", "quantidade"]),
  T("create_requisicao", "Cria uma requisição de material para uma obra.", {
    obra_nome: { type: "string" },
    solicitante: { type: "string" },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          produto_nome: { type: "string" },
          quantidade: { type: "number" },
        },
        required: ["produto_nome", "quantidade"],
        additionalProperties: false,
      },
    },
  }, ["obra_nome", "itens"]),

  // ===== RH =====
  T("list_colaboradores", "Lista colaboradores ativos.", {
    busca: { type: "string" },
  }),
  T("create_colaborador", "Cadastra um colaborador.", {
    nome: { type: "string" },
    cpf: { type: "string" },
    cargo: { type: "string" },
    vinculo: { type: "string", enum: ["clt", "diarista", "empreiteiro", "autonomo"] },
    remuneracao: { type: "number" },
    telefone: { type: "string" },
    email: { type: "string" },
    data_entrada: { type: "string", description: "YYYY-MM-DD" },
  }, ["nome", "vinculo", "remuneracao"]),
  T("vincular_colaborador_obra", "Vincula um colaborador a uma obra.", {
    colaborador_nome: { type: "string" },
    obra_nome: { type: "string" },
    data_inicio: { type: "string" },
  }, ["colaborador_nome", "obra_nome"]),
  T("desligar_colaborador", "Desliga (inativa) um colaborador, definindo data de saída.", {
    colaborador_nome: { type: "string" },
    data_saida: { type: "string", description: "YYYY-MM-DD; default hoje" },
  }, ["colaborador_nome"]),

  // ===== Medições =====
  T("list_medicoes", "Lista medições de obra.", {
    obra_nome: { type: "string" },
  }),
  T("create_medicao", "Cria uma medição de obra para uma data.", {
    obra_nome: { type: "string" },
    data: { type: "string", description: "YYYY-MM-DD; default hoje" },
    valor_total: { type: "number" },
    observacoes: { type: "string" },
  }, ["obra_nome", "valor_total"]),

  // ===== Relatórios =====
  T("fluxo_caixa", "Resumo de fluxo de caixa (entradas, saídas, saldo) por período.", {
    desde: { type: "string", description: "YYYY-MM-DD; default 30 dias atrás" },
    ate: { type: "string", description: "YYYY-MM-DD; default hoje" },
    obra_nome: { type: "string" },
  }),
  T("dashboard_geral", "KPIs gerais: saldo dos bancos, contas em atraso, obras ativas, próximos vencimentos.", {}),
  T("relatorio_obra", "Custo realizado por etapa vs orçamento de uma obra.", {
    obra_nome: { type: "string" },
  }, ["obra_nome"]),
];

// Ações que mutam dados → exigem confirmação do usuário
const MUTATING_TOOLS = new Set([
  "create_obra",
  "update_obra",
  "archive_obra",
  "create_etapa",
  "create_subetapa",
  "update_subetapa",
  "delete_etapa",
  "delete_subetapa",
  "create_compra",
  "cancel_compra",
  "create_rdo",
  "add_rdo_equipe",
  "add_rdo_atividade",
  "add_rdo_ocorrencia",
  "create_conta_pagar",
  "create_conta_receber",
  "pagar_conta",
  "receber_conta",
  "create_conta_bancaria",
  "create_transferencia",
  "create_cartao",
  "pagar_fatura_cartao",
  "create_fornecedor",
  "update_fornecedor",
  "create_categoria",
  "create_empresa",
  "create_produto",
  "create_almoxarifado",
  "movimentar_estoque",
  "create_requisicao",
  "create_colaborador",
  "vincular_colaborador_obra",
  "desligar_colaborador",
  "create_medicao",
]);

const SYSTEM_PROMPT = `Você é o assistente do Mestre360, um ERP para construção civil.

Seu papel:
- Ajudar o usuário a executar TODAS as ações possíveis no sistema: gestão de obras, orçamento, compras, RDO, financeiro (contas a pagar/receber, bancos, cartões, transferências), estoque, RH e medições.
- Tirar dúvidas sobre o uso da plataforma.
- Quando o usuário pedir algo que envolva criar/editar/consultar dados, USE as ferramentas (function calls). Não invente respostas dizendo "fiz isso" sem ter chamado a função.
- Sempre fale em português do Brasil, com tom direto, simpático e objetivo (mestre de obras, engenheiro).
- Datas: use YYYY-MM-DD. Se o usuário disser "hoje", "amanhã", "sexta", calcule com base em ${new Date().toISOString().slice(0, 10)} (timezone America/Sao_Paulo).
- Valores em reais: aceite "5 mil", "R$ 5.000", "5000,50" e converta para número decimal com ponto.
- Antes de criar coisas com valores ou para a obra errada, prefira confirmar com o usuário se ambíguo.
- Se faltar uma informação obrigatória, pergunte antes de chamar a função.
- Para buscar nomes (obras, fornecedores, produtos, contas), as funções fazem busca por similaridade. Tente o que o usuário disse.
- Pode encadear chamadas: ex.: list_obras para descobrir nomes, depois create_etapa.`;

// ---------- Helpers ----------
async function getCustomerId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Conta não identificada");
  return data.id;
}

async function isEmpresarial(supabase: any, customerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plans(features)")
    .eq("customer_id", customerId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const feats = (data as any)?.plans?.features;
  return Array.isArray(feats) && feats.includes("ai_assistant");
}

async function findObra(supabase: any, customerId: string, nome: string) {
  const { data } = await supabase
    .from("obras")
    .select("id, name")
    .eq("customer_id", customerId)
    .ilike("name", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Obra "${nome}" não encontrada`);
  return data as { id: string; name: string };
}

async function findOrCreateFornecedor(supabase: any, customerId: string, userId: string, nome: string) {
  const { data: exist } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("customer_id", customerId)
    .ilike("nome", nome.trim())
    .limit(1)
    .maybeSingle();
  if (exist) return exist;
  const { data, error } = await supabase
    .from("fornecedores")
    .insert({ customer_id: customerId, created_by: userId, nome: nome.trim() })
    .select("id, nome")
    .single();
  if (error) throw new Error(`Erro ao criar fornecedor: ${error.message}`);
  return data;
}

async function findCategoria(supabase: any, customerId: string, nome: string, tipo: "despesa" | "receita") {
  const { data } = await supabase
    .from("categorias_financeiras")
    .select("id")
    .eq("customer_id", customerId)
    .eq("tipo", tipo)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findContaBancaria(supabase: any, customerId: string, nome: string) {
  const { data } = await supabase
    .from("contas_bancarias")
    .select("id, nome")
    .eq("customer_id", customerId)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Conta bancária "${nome}" não encontrada`);
  return data as { id: string; nome: string };
}

async function findCartao(supabase: any, customerId: string, nome: string) {
  const { data } = await supabase
    .from("cartoes")
    .select("id, nome, dia_fechamento, dia_vencimento")
    .eq("customer_id", customerId)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Cartão "${nome}" não encontrado`);
  return data as { id: string; nome: string; dia_fechamento: number; dia_vencimento: number };
}

async function findEtapa(supabase: any, obraId: string, nome: string) {
  const { data } = await supabase
    .from("orcamento_etapas")
    .select("id, nome")
    .eq("obra_id", obraId)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Etapa "${nome}" não encontrada`);
  return data as { id: string; nome: string };
}

async function findSubetapa(supabase: any, etapaId: string, nome: string) {
  const { data } = await supabase
    .from("orcamento_subetapas")
    .select("id, nome, valor_orcado")
    .eq("etapa_id", etapaId)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Subetapa "${nome}" não encontrada`);
  return data as { id: string; nome: string; valor_orcado: number };
}

async function findProduto(supabase: any, customerId: string, nome: string) {
  const { data } = await supabase
    .from("produtos")
    .select("id, nome, unidade")
    .eq("customer_id", customerId)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Produto "${nome}" não encontrado`);
  return data as { id: string; nome: string; unidade: string };
}

async function findAlmoxarifado(supabase: any, customerId: string, nome: string) {
  const { data } = await supabase
    .from("almoxarifados")
    .select("id, nome")
    .eq("customer_id", customerId)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Almoxarifado "${nome}" não encontrado`);
  return data as { id: string; nome: string };
}

async function findColaborador(supabase: any, customerId: string, nome: string) {
  const { data } = await supabase
    .from("colaboradores")
    .select("id, nome")
    .eq("customer_id", customerId)
    .eq("ativo", true)
    .ilike("nome", `%${nome.trim()}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Colaborador "${nome}" não encontrado`);
  return data as { id: string; nome: string };
}

async function getOrCreateRdoId(supabase: any, customerId: string, userId: string, obraId: string, dataStr?: string) {
  if (dataStr) {
    const { data: existing } = await supabase
      .from("rdos")
      .select("id")
      .eq("obra_id", obraId)
      .eq("data", dataStr)
      .maybeSingle();
    if (existing) return existing.id as string;
    const { data, error } = await supabase
      .from("rdos")
      .insert({
        customer_id: customerId,
        obra_id: obraId,
        data: dataStr,
        condicao: "trabalhada",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }
  // pega RDO mais recente
  const { data: last } = await supabase
    .from("rdos")
    .select("id")
    .eq("obra_id", obraId)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) throw new Error("Nenhum RDO encontrado para essa obra — crie um RDO antes.");
  return last.id as string;
}

const brl = (n: any) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- Executors ----------
async function executeTool(
  supabase: any,
  customerId: string,
  userId: string,
  name: string,
  args: any,
): Promise<{ ok: boolean; summary: string; data?: any }> {
  switch (name) {
    // ===== Obras =====
    case "list_obras": {
      let q = supabase.from("obras").select("id, name, status").eq("customer_id", customerId).order("name");
      if (!args.incluir_arquivadas) q = q.neq("status", "arquivada");
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} obras.`, data: data ?? [] };
    }
    case "get_obra_resumo": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const { data: etapas } = await supabase
        .from("orcamento_etapas")
        .select("id, nome, percentual, orcamento_subetapas(valor_orcado)")
        .eq("obra_id", obra.id);
      const totalOrcado = (etapas || []).reduce(
        (s: number, e: any) => s + (e.orcamento_subetapas || []).reduce((x: number, sub: any) => x + Number(sub.valor_orcado || 0), 0),
        0,
      );
      const { data: compras } = await supabase
        .from("compras")
        .select("valor_total")
        .eq("obra_id", obra.id)
        .neq("status", "cancelada");
      const totalRealizado = (compras || []).reduce((s: number, c: any) => s + Number(c.valor_total || 0), 0);
      const pctMedio = etapas?.length
        ? (etapas.reduce((s: number, e: any) => s + Number(e.percentual || 0), 0) / etapas.length).toFixed(1)
        : "0";
      return {
        ok: true,
        summary: `${obra.name}: orçado R$ ${brl(totalOrcado)}, realizado R$ ${brl(totalRealizado)}, ${pctMedio}% médio de conclusão, ${etapas?.length ?? 0} etapas.`,
        data: { obra, totalOrcado, totalRealizado, etapas: etapas?.length },
      };
    }
    case "create_obra": {
      const { data, error } = await supabase
        .from("obras")
        .insert({
          customer_id: customerId,
          name: args.nome,
          description: args.descricao ?? null,
          address_city: args.cidade ?? null,
          address_state: args.estado ?? null,
          contact_name: args.contato_nome ?? null,
          contact_whatsapp: args.contato_whatsapp ?? null,
          status: "ativa",
          created_by: userId,
        })
        .select("id, name")
        .single();
      if (error) throw new Error(`Erro ao criar obra: ${error.message}`);
      return { ok: true, summary: `Obra "${data.name}" criada.`, data };
    }
    case "update_obra": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const patch: any = {};
      if (args.novo_nome) patch.name = args.novo_nome;
      if (args.descricao !== undefined) patch.description = args.descricao;
      if (args.cidade !== undefined) patch.address_city = args.cidade;
      if (args.estado !== undefined) patch.address_state = args.estado;
      if (args.contato_nome !== undefined) patch.contact_name = args.contato_nome;
      if (args.contato_whatsapp !== undefined) patch.contact_whatsapp = args.contato_whatsapp;
      if (args.start_date) patch.start_date = args.start_date;
      if (args.expected_end_date) patch.expected_end_date = args.expected_end_date;
      const { error } = await supabase.from("obras").update(patch).eq("id", obra.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Obra "${obra.name}" atualizada.` };
    }
    case "archive_obra": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const status = args.arquivar ? "arquivada" : "ativa";
      const { error } = await supabase.from("obras").update({ status }).eq("id", obra.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Obra "${obra.name}" ${args.arquivar ? "arquivada" : "reativada"}.` };
    }

    // ===== Orçamento =====
    case "list_etapas": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const { data } = await supabase
        .from("orcamento_etapas")
        .select("id, nome, percentual, ordem, orcamento_subetapas(id, nome, valor_orcado)")
        .eq("obra_id", obra.id)
        .order("ordem");
      const total = (data || []).reduce(
        (s: number, e: any) => s + (e.orcamento_subetapas || []).reduce((x: number, sub: any) => x + Number(sub.valor_orcado || 0), 0),
        0,
      );
      return { ok: true, summary: `${data?.length ?? 0} etapas em ${obra.name} (R$ ${brl(total)} orçado).`, data: data ?? [] };
    }
    case "create_etapa": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const { data: max } = await supabase
        .from("orcamento_etapas")
        .select("ordem")
        .eq("obra_id", obra.id)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ordem = (max?.ordem ?? -1) + 1;
      const { data, error } = await supabase
        .from("orcamento_etapas")
        .insert({
          customer_id: customerId,
          obra_id: obra.id,
          nome: args.nome,
          ordem,
          percentual: 0,
          created_by: userId,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Etapa "${data.nome}" criada em ${obra.name}.`, data };
    }
    case "create_subetapa": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const etapa = await findEtapa(supabase, obra.id, args.etapa_nome);
      const { data: max } = await supabase
        .from("orcamento_subetapas")
        .select("ordem")
        .eq("etapa_id", etapa.id)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ordem = (max?.ordem ?? -1) + 1;
      const { data, error } = await supabase
        .from("orcamento_subetapas")
        .insert({
          customer_id: customerId,
          etapa_id: etapa.id,
          nome: args.nome,
          valor_orcado: args.valor_orcado,
          ordem,
          created_by: userId,
        })
        .select("id, nome, valor_orcado")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        summary: `Subetapa "${data.nome}" (R$ ${brl(data.valor_orcado)}) criada em "${etapa.nome}".`,
        data,
      };
    }
    case "update_subetapa": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const etapa = await findEtapa(supabase, obra.id, args.etapa_nome);
      const sub = await findSubetapa(supabase, etapa.id, args.subetapa_nome);
      const patch: any = {};
      if (args.novo_valor !== undefined) patch.valor_orcado = args.novo_valor;
      if (args.percentual !== undefined) patch.percentual = args.percentual;
      const { error } = await supabase.from("orcamento_subetapas").update(patch).eq("id", sub.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Subetapa "${sub.nome}" atualizada.` };
    }
    case "delete_etapa": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const etapa = await findEtapa(supabase, obra.id, args.etapa_nome);
      const { error } = await supabase.from("orcamento_etapas").delete().eq("id", etapa.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Etapa "${etapa.nome}" excluída.` };
    }
    case "delete_subetapa": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const etapa = await findEtapa(supabase, obra.id, args.etapa_nome);
      const sub = await findSubetapa(supabase, etapa.id, args.subetapa_nome);
      const { error } = await supabase.from("orcamento_subetapas").delete().eq("id", sub.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Subetapa "${sub.nome}" excluída.` };
    }

    // ===== Compras =====
    case "list_compras": {
      let q = supabase
        .from("compras")
        .select("id, descricao, valor_total, data_compra, status, obras(name), fornecedores(nome)")
        .eq("customer_id", customerId)
        .order("data_compra", { ascending: false })
        .limit(args.limit ?? 20);
      if (args.obra_nome) {
        const o = await findObra(supabase, customerId, args.obra_nome);
        q = q.eq("obra_id", o.id);
      }
      if (args.desde) q = q.gte("data_compra", args.desde);
      if (args.ate) q = q.lte("data_compra", args.ate);
      const { data } = await q;
      let result = data ?? [];
      if (args.fornecedor_nome) {
        const f = args.fornecedor_nome.toLowerCase();
        result = result.filter((c: any) => c.fornecedores?.nome?.toLowerCase().includes(f));
      }
      return { ok: true, summary: `${result.length} compras.`, data: result };
    }
    case "get_compra": {
      const { data, error } = await supabase
        .from("compras")
        .select(
          "id, descricao, valor_total, data_compra, forma_pagamento, qtd_parcelas, status, observacoes, obras(name), fornecedores(nome), compra_itens(descricao, quantidade, valor_unitario, valor_total, qtd_recebida), compra_parcelas(numero, valor, vencimento)",
        )
        .eq("id", args.compra_id)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Compra não encontrada");
      return { ok: true, summary: `Compra "${data.descricao}" (R$ ${brl(data.valor_total)}).`, data };
    }
    case "create_compra": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const etapa = await findEtapa(supabase, obra.id, args.etapa_nome);
      const sub = await findSubetapa(supabase, etapa.id, args.subetapa_nome);
      let fornecedor_id: string | null = null;
      if (args.fornecedor_nome) {
        const f = await findOrCreateFornecedor(supabase, customerId, userId, args.fornecedor_nome);
        fornecedor_id = f.id;
      }
      const dataCompra = args.data_compra || new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("compras")
        .insert({
          customer_id: customerId,
          obra_id: obra.id,
          etapa_id: etapa.id,
          subetapa_id: sub.id,
          fornecedor_id,
          descricao: args.descricao,
          forma_pagamento: args.forma_pagamento,
          qtd_parcelas: args.qtd_parcelas ?? 1,
          data_compra: dataCompra,
          data_primeira_parcela: dataCompra,
          valor_total: args.valor_total,
          created_by: userId,
        })
        .select("id, descricao, valor_total")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        summary: `Compra "${data.descricao}" registrada em ${obra.name} › ${etapa.nome} › ${sub.nome} (R$ ${brl(data.valor_total)}).`,
        data,
      };
    }
    case "cancel_compra": {
      const { error } = await supabase
        .from("compras")
        .update({ status: "cancelada" })
        .eq("id", args.compra_id)
        .eq("customer_id", customerId);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Compra cancelada.` };
    }

    // ===== RDO =====
    case "create_rdo": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const dataRdo = args.data || new Date().toISOString().slice(0, 10);
      const { data: rdo, error } = await supabase
        .from("rdos")
        .insert({
          customer_id: customerId,
          obra_id: obra.id,
          data: dataRdo,
          condicao: args.condicao,
          clima_manha: args.clima || null,
          observacoes: args.observacoes || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (args.atividade) {
        await supabase.from("rdo_atividades").insert({
          customer_id: customerId,
          rdo_id: rdo.id,
          descricao: args.atividade,
          percentual: 0,
        });
      }
      return { ok: true, summary: `RDO de ${dataRdo} criado para ${obra.name} (${args.condicao}).`, data: rdo };
    }
    case "add_rdo_equipe": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const rdoId = await getOrCreateRdoId(supabase, customerId, userId, obra.id, args.data);
      const { error } = await supabase.from("rdo_equipes").insert({
        customer_id: customerId,
        rdo_id: rdoId,
        funcao: args.funcao,
        quantidade: args.quantidade,
        horas: args.horas,
        empreiteiro: args.empreiteiro || null,
      });
      if (error) throw new Error(error.message);
      return { ok: true, summary: `${args.quantidade}× ${args.funcao} (${args.horas}h) adicionado ao RDO.` };
    }
    case "add_rdo_atividade": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const rdoId = await getOrCreateRdoId(supabase, customerId, userId, obra.id, args.data);
      const { error } = await supabase.from("rdo_atividades").insert({
        customer_id: customerId,
        rdo_id: rdoId,
        descricao: args.descricao,
        percentual: args.percentual ?? 0,
      });
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Atividade adicionada ao RDO.` };
    }
    case "add_rdo_ocorrencia": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const rdoId = await getOrCreateRdoId(supabase, customerId, userId, obra.id, args.data);
      const { error } = await supabase.from("rdo_ocorrencias").insert({
        customer_id: customerId,
        rdo_id: rdoId,
        tipo: args.tipo,
        descricao: args.descricao,
      });
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Ocorrência (${args.tipo}) adicionada ao RDO.` };
    }

    // ===== Contas a Pagar / Receber =====
    case "list_contas_pagar": {
      let q = supabase
        .from("contas_pagar")
        .select("id, descricao, valor, vencimento, status, obras(name), fornecedores(nome)")
        .eq("customer_id", customerId)
        .order("vencimento")
        .limit(args.limit ?? 30);
      if (args.status === "atrasada") q = q.eq("status", "pendente").lt("vencimento", new Date().toISOString().slice(0, 10));
      else if (args.status) q = q.eq("status", args.status);
      if (args.desde) q = q.gte("vencimento", args.desde);
      if (args.ate) q = q.lte("vencimento", args.ate);
      if (args.obra_nome) {
        const o = await findObra(supabase, customerId, args.obra_nome);
        q = q.eq("obra_id", o.id);
      }
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} contas a pagar.`, data: data ?? [] };
    }
    case "list_contas_receber": {
      let q = supabase
        .from("contas_receber")
        .select("id, descricao, valor, vencimento, status, obras(name)")
        .eq("customer_id", customerId)
        .order("vencimento")
        .limit(args.limit ?? 30);
      if (args.status === "atrasada") q = q.eq("status", "pendente").lt("vencimento", new Date().toISOString().slice(0, 10));
      else if (args.status) q = q.eq("status", args.status);
      if (args.desde) q = q.gte("vencimento", args.desde);
      if (args.ate) q = q.lte("vencimento", args.ate);
      if (args.obra_nome) {
        const o = await findObra(supabase, customerId, args.obra_nome);
        q = q.eq("obra_id", o.id);
      }
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} contas a receber.`, data: data ?? [] };
    }
    case "create_conta_pagar": {
      let obra_id: string | null = null;
      if (args.obra_nome) obra_id = (await findObra(supabase, customerId, args.obra_nome)).id;
      let fornecedor_id: string | null = null;
      if (args.fornecedor_nome) {
        const f = await findOrCreateFornecedor(supabase, customerId, userId, args.fornecedor_nome);
        fornecedor_id = f.id;
      }
      let categoria_id: string | null = null;
      if (args.categoria_nome)
        categoria_id = await findCategoria(supabase, customerId, args.categoria_nome, "despesa");
      const { data, error } = await supabase
        .from("contas_pagar")
        .insert({
          customer_id: customerId,
          obra_id,
          fornecedor_id,
          categoria_id,
          descricao: args.descricao,
          valor: args.valor,
          vencimento: args.vencimento,
          status: "pendente",
          origem: "manual",
          created_by: userId,
        })
        .select("id, descricao, valor, vencimento")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        summary: `Conta a pagar "${data.descricao}" criada — R$ ${brl(data.valor)} vencendo em ${data.vencimento}.`,
        data,
      };
    }
    case "create_conta_receber": {
      let obra_id: string | null = null;
      if (args.obra_nome) obra_id = (await findObra(supabase, customerId, args.obra_nome)).id;
      let categoria_id: string | null = null;
      if (args.categoria_nome)
        categoria_id = await findCategoria(supabase, customerId, args.categoria_nome, "receita");
      const { data, error } = await supabase
        .from("contas_receber")
        .insert({
          customer_id: customerId,
          obra_id,
          categoria_id,
          descricao: args.descricao,
          valor: args.valor,
          vencimento: args.vencimento,
          status: "pendente",
          origem: "manual",
          created_by: userId,
        })
        .select("id, descricao, valor, vencimento")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        summary: `Conta a receber "${data.descricao}" criada — R$ ${brl(data.valor)} vencendo em ${data.vencimento}.`,
        data,
      };
    }
    case "pagar_conta": {
      const { data: cp } = await supabase
        .from("contas_pagar")
        .select("id, descricao, valor")
        .eq("customer_id", customerId)
        .eq("status", "pendente")
        .ilike("descricao", `%${args.descricao_busca}%`)
        .order("vencimento")
        .limit(1)
        .maybeSingle();
      if (!cp) throw new Error(`Conta a pagar pendente "${args.descricao_busca}" não encontrada`);
      const banco = await findContaBancaria(supabase, customerId, args.conta_bancaria_nome);
      const valorPago = args.valor_pago ?? cp.valor;
      const pagoEm = args.data_pagamento || new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("contas_pagar")
        .update({
          status: "pago",
          conta_bancaria_id: banco.id,
          valor_pago: valorPago,
          pago_em: pagoEm,
        })
        .eq("id", cp.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Conta "${cp.descricao}" paga: R$ ${brl(valorPago)} via ${banco.nome} em ${pagoEm}.` };
    }
    case "receber_conta": {
      const { data: cr } = await supabase
        .from("contas_receber")
        .select("id, descricao, valor")
        .eq("customer_id", customerId)
        .eq("status", "pendente")
        .ilike("descricao", `%${args.descricao_busca}%`)
        .order("vencimento")
        .limit(1)
        .maybeSingle();
      if (!cr) throw new Error(`Conta a receber pendente "${args.descricao_busca}" não encontrada`);
      const banco = await findContaBancaria(supabase, customerId, args.conta_bancaria_nome);
      const valorRec = args.valor_recebido ?? cr.valor;
      const recEm = args.data_recebimento || new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("contas_receber")
        .update({
          status: "recebido",
          conta_bancaria_id: banco.id,
          valor_recebido: valorRec,
          recebido_em: recEm,
        })
        .eq("id", cr.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Conta "${cr.descricao}" recebida: R$ ${brl(valorRec)} em ${banco.nome} (${recEm}).` };
    }

    // ===== Bancos =====
    case "list_contas_bancarias": {
      const { data } = await supabase
        .from("contas_bancarias")
        .select("id, nome, banco, tipo, saldo_atual, ativo")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome");
      const total = (data || []).reduce((s: number, c: any) => s + Number(c.saldo_atual || 0), 0);
      return { ok: true, summary: `${data?.length ?? 0} contas, saldo total R$ ${brl(total)}.`, data: data ?? [] };
    }
    case "create_conta_bancaria": {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .insert({
          customer_id: customerId,
          nome: args.nome,
          banco: args.banco || null,
          agencia: args.agencia || null,
          conta: args.conta || null,
          tipo: args.tipo,
          saldo_inicial: args.saldo_inicial ?? 0,
          saldo_atual: args.saldo_inicial ?? 0,
          ativo: true,
          created_by: userId,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Conta bancária "${data.nome}" criada.`, data };
    }
    case "create_transferencia": {
      const origem = await findContaBancaria(supabase, customerId, args.conta_origem_nome);
      const destino = await findContaBancaria(supabase, customerId, args.conta_destino_nome);
      if (origem.id === destino.id) throw new Error("Origem e destino devem ser contas diferentes");
      const dataT = args.data || new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("transferencias").insert({
        customer_id: customerId,
        conta_origem_id: origem.id,
        conta_destino_id: destino.id,
        valor: args.valor,
        data: dataT,
        descricao: args.descricao || null,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Transferência R$ ${brl(args.valor)}: ${origem.nome} → ${destino.nome} em ${dataT}.` };
    }
    case "list_lancamentos": {
      let q = supabase
        .from("lancamentos")
        .select("id, data, tipo, valor, descricao, contas_bancarias(nome)")
        .eq("customer_id", customerId)
        .order("data", { ascending: false })
        .limit(args.limit ?? 30);
      if (args.conta_bancaria_nome) {
        const b = await findContaBancaria(supabase, customerId, args.conta_bancaria_nome);
        q = q.eq("conta_bancaria_id", b.id);
      }
      if (args.desde) q = q.gte("data", args.desde);
      if (args.ate) q = q.lte("data", args.ate);
      if (args.tipo) q = q.eq("tipo", args.tipo);
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} lançamentos.`, data: data ?? [] };
    }

    // ===== Cartões =====
    case "list_cartoes": {
      const { data } = await supabase
        .from("cartoes")
        .select("id, nome, bandeira, limite, dia_fechamento, dia_vencimento, ativo")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome");
      return { ok: true, summary: `${data?.length ?? 0} cartões.`, data: data ?? [] };
    }
    case "create_cartao": {
      const { data, error } = await supabase
        .from("cartoes")
        .insert({
          customer_id: customerId,
          nome: args.nome,
          bandeira: args.bandeira || null,
          ultimos_4: args.ultimos_4 || null,
          limite: args.limite,
          dia_fechamento: args.dia_fechamento,
          dia_vencimento: args.dia_vencimento,
          ativo: true,
          created_by: userId,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Cartão "${data.nome}" criado.`, data };
    }
    case "list_faturas_cartao": {
      let q = supabase
        .from("faturas_cartao")
        .select("id, competencia, dt_fechamento, dt_vencimento, valor_total, status, cartoes(nome)")
        .eq("customer_id", customerId)
        .order("competencia", { ascending: false })
        .limit(20);
      if (args.status) q = q.eq("status", args.status);
      if (args.cartao_nome) {
        const c = await findCartao(supabase, customerId, args.cartao_nome);
        q = q.eq("cartao_id", c.id);
      }
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} faturas.`, data: data ?? [] };
    }
    case "pagar_fatura_cartao": {
      const cartao = await findCartao(supabase, customerId, args.cartao_nome);
      const { data: fat } = await supabase
        .from("faturas_cartao")
        .select("id, status, valor_total, competencia")
        .eq("cartao_id", cartao.id)
        .eq("competencia", args.competencia)
        .maybeSingle();
      if (!fat) throw new Error(`Fatura ${args.competencia} do cartão ${cartao.nome} não encontrada`);
      // Garante que está fechada → trigger gera a conta a pagar
      if (fat.status === "aberta") {
        await supabase.from("faturas_cartao").update({ status: "fechada" }).eq("id", fat.id);
      }
      // Localiza a conta a pagar vinculada
      const { data: cp } = await supabase
        .from("contas_pagar")
        .select("id, descricao, valor, status")
        .eq("fatura_cartao_id", fat.id)
        .maybeSingle();
      if (!cp) {
        return { ok: true, summary: `Fatura ${args.competencia} fechada. Conta a pagar vinculada ainda não criada — tente novamente em instantes.` };
      }
      if (cp.status === "pago") return { ok: true, summary: `Fatura ${args.competencia} já estava paga.` };
      if (!args.conta_bancaria_nome) {
        return { ok: true, summary: `Fatura ${args.competencia} fechada (R$ ${brl(cp.valor)}). Informe a conta bancária para dar baixa.` };
      }
      const banco = await findContaBancaria(supabase, customerId, args.conta_bancaria_nome);
      const pagoEm = args.data_pagamento || new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("contas_pagar")
        .update({ status: "pago", conta_bancaria_id: banco.id, valor_pago: cp.valor, pago_em: pagoEm })
        .eq("id", cp.id);
      if (error) throw new Error(error.message);
      await supabase.from("faturas_cartao").update({ status: "paga", pago_em: pagoEm, valor_pago: cp.valor }).eq("id", fat.id);
      return { ok: true, summary: `Fatura ${args.competencia} (${cartao.nome}) paga: R$ ${brl(cp.valor)} via ${banco.nome}.` };
    }

    // ===== Fornecedores =====
    case "list_fornecedores": {
      let q = supabase
        .from("fornecedores")
        .select("id, nome, cpf_cnpj, telefone, email")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome")
        .limit(50);
      if (args.busca) q = q.ilike("nome", `%${args.busca}%`);
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} fornecedores.`, data: data ?? [] };
    }
    case "create_fornecedor": {
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({
          customer_id: customerId,
          nome: args.nome,
          cpf_cnpj: args.cpf_cnpj || null,
          email: args.email || null,
          telefone: args.telefone || null,
          contato: args.contato || null,
          created_by: userId,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Fornecedor "${data.nome}" criado.`, data };
    }
    case "update_fornecedor": {
      const { data: f } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("customer_id", customerId)
        .ilike("nome", `%${args.nome_busca}%`)
        .limit(1)
        .maybeSingle();
      if (!f) throw new Error(`Fornecedor "${args.nome_busca}" não encontrado`);
      const patch: any = {};
      if (args.novo_nome) patch.nome = args.novo_nome;
      if (args.cpf_cnpj !== undefined) patch.cpf_cnpj = args.cpf_cnpj;
      if (args.email !== undefined) patch.email = args.email;
      if (args.telefone !== undefined) patch.telefone = args.telefone;
      if (args.contato !== undefined) patch.contato = args.contato;
      const { error } = await supabase.from("fornecedores").update(patch).eq("id", f.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Fornecedor "${f.nome}" atualizado.` };
    }

    // ===== Categorias =====
    case "list_categorias": {
      let q = supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome");
      if (args.tipo) q = q.eq("tipo", args.tipo);
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} categorias.`, data: data ?? [] };
    }
    case "create_categoria": {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .insert({ customer_id: customerId, nome: args.nome, tipo: args.tipo, ativo: true })
        .select("id, nome, tipo")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Categoria "${data.nome}" (${data.tipo}) criada.`, data };
    }

    // ===== Empresas =====
    case "list_empresas": {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .eq("customer_id", customerId)
        .order("nome");
      return { ok: true, summary: `${data?.length ?? 0} empresas.`, data: data ?? [] };
    }
    case "create_empresa": {
      const { data, error } = await supabase
        .from("empresas")
        .insert({ customer_id: customerId, nome: args.nome, cnpj: args.cnpj || null, created_by: userId })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Empresa "${data.nome}" criada.`, data };
    }

    // ===== Estoque =====
    case "list_produtos": {
      let q = supabase
        .from("produtos")
        .select("id, nome, unidade, codigo, custo_medio, estoque_saldos(quantidade)")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome")
        .limit(args.limit ?? 50);
      if (args.busca) q = q.ilike("nome", `%${args.busca}%`);
      const { data } = await q;
      const enriched = (data || []).map((p: any) => ({
        ...p,
        saldo_total: (p.estoque_saldos || []).reduce((s: number, e: any) => s + Number(e.quantidade || 0), 0),
      }));
      return { ok: true, summary: `${enriched.length} produtos.`, data: enriched };
    }
    case "create_produto": {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          customer_id: customerId,
          nome: args.nome,
          unidade: args.unidade,
          codigo: args.codigo || null,
          categoria: args.categoria || null,
          estoque_minimo: args.estoque_minimo ?? 0,
          custo_medio: 0,
          ativo: true,
          created_by: userId,
        })
        .select("id, nome, unidade")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Produto "${data.nome}" (${data.unidade}) criado.`, data };
    }
    case "list_almoxarifados": {
      let q = supabase
        .from("almoxarifados")
        .select("id, nome, principal, obras(name)")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome");
      if (args.obra_nome) {
        const o = await findObra(supabase, customerId, args.obra_nome);
        q = q.eq("obra_id", o.id);
      }
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} almoxarifados.`, data: data ?? [] };
    }
    case "create_almoxarifado": {
      let obra_id: string | null = null;
      if (args.obra_nome) obra_id = (await findObra(supabase, customerId, args.obra_nome)).id;
      const { data, error } = await supabase
        .from("almoxarifados")
        .insert({
          customer_id: customerId,
          obra_id,
          nome: args.nome,
          principal: args.principal ?? false,
          ativo: true,
          created_by: userId,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Almoxarifado "${data.nome}" criado.`, data };
    }
    case "movimentar_estoque": {
      const produto = await findProduto(supabase, customerId, args.produto_nome);
      const almox = await findAlmoxarifado(supabase, customerId, args.almoxarifado_nome);
      const { error } = await supabase.from("estoque_movimentacoes").insert({
        customer_id: customerId,
        produto_id: produto.id,
        almoxarifado_id: almox.id,
        tipo: args.tipo,
        origem: "manual",
        quantidade: args.quantidade,
        custo_unitario: args.custo_unitario ?? 0,
        data: args.data || new Date().toISOString().slice(0, 10),
        observacoes: args.observacoes || null,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
      return { ok: true, summary: `${args.tipo} de ${args.quantidade} ${produto.unidade} de "${produto.nome}" em ${almox.nome}.` };
    }
    case "create_requisicao": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      // pega próximo numero
      const { data: maxNum } = await supabase
        .from("requisicoes")
        .select("numero")
        .eq("customer_id", customerId)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      const numero = (maxNum?.numero ?? 0) + 1;
      const { data: req, error } = await supabase
        .from("requisicoes")
        .insert({
          customer_id: customerId,
          obra_id: obra.id,
          numero,
          solicitante: args.solicitante || null,
          data: new Date().toISOString().slice(0, 10),
          status: "aberta",
          created_by: userId,
        })
        .select("id, numero")
        .single();
      if (error) throw new Error(error.message);
      // itens
      const itensInsert = [];
      for (const it of args.itens) {
        const p = await findProduto(supabase, customerId, it.produto_nome);
        itensInsert.push({
          customer_id: customerId,
          requisicao_id: req.id,
          produto_id: p.id,
          quantidade: it.quantidade,
          qtd_atendida: 0,
        });
      }
      if (itensInsert.length) {
        const { error: e2 } = await supabase.from("requisicao_itens").insert(itensInsert);
        if (e2) throw new Error(e2.message);
      }
      return { ok: true, summary: `Requisição #${req.numero} criada em ${obra.name} com ${itensInsert.length} itens.`, data: req };
    }

    // ===== RH =====
    case "list_colaboradores": {
      let q = supabase
        .from("colaboradores")
        .select("id, nome, cargo, vinculo, ativo")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome")
        .limit(100);
      if (args.busca) q = q.ilike("nome", `%${args.busca}%`);
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} colaboradores.`, data: data ?? [] };
    }
    case "create_colaborador": {
      const { data, error } = await supabase
        .from("colaboradores")
        .insert({
          customer_id: customerId,
          nome: args.nome,
          cpf: args.cpf || null,
          cargo: args.cargo || null,
          vinculo: args.vinculo,
          remuneracao: args.remuneracao,
          telefone: args.telefone || null,
          email: args.email || null,
          data_entrada: args.data_entrada || null,
          ativo: true,
          created_by: userId,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Colaborador "${data.nome}" cadastrado.`, data };
    }
    case "vincular_colaborador_obra": {
      const col = await findColaborador(supabase, customerId, args.colaborador_nome);
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const { error } = await supabase.from("colaborador_obras").insert({
        customer_id: customerId,
        colaborador_id: col.id,
        obra_id: obra.id,
        data_inicio: args.data_inicio || new Date().toISOString().slice(0, 10),
      });
      if (error) throw new Error(error.message);
      return { ok: true, summary: `${col.nome} vinculado à obra ${obra.name}.` };
    }
    case "desligar_colaborador": {
      const col = await findColaborador(supabase, customerId, args.colaborador_nome);
      const { error } = await supabase
        .from("colaboradores")
        .update({ ativo: false, data_saida: args.data_saida || new Date().toISOString().slice(0, 10) })
        .eq("id", col.id);
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Colaborador "${col.nome}" desligado.` };
    }

    // ===== Medições =====
    case "list_medicoes": {
      let q = supabase
        .from("medicoes_obra")
        .select("id, numero, data, valor_total, status, obras(name)")
        .eq("customer_id", customerId)
        .order("data", { ascending: false })
        .limit(30);
      if (args.obra_nome) {
        const o = await findObra(supabase, customerId, args.obra_nome);
        q = q.eq("obra_id", o.id);
      }
      const { data } = await q;
      return { ok: true, summary: `${data?.length ?? 0} medições.`, data: data ?? [] };
    }
    case "create_medicao": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const { data: maxNum } = await supabase
        .from("medicoes_obra")
        .select("numero")
        .eq("obra_id", obra.id)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      const numero = (maxNum?.numero ?? 0) + 1;
      const { data, error } = await supabase
        .from("medicoes_obra")
        .insert({
          customer_id: customerId,
          obra_id: obra.id,
          numero,
          data: args.data || new Date().toISOString().slice(0, 10),
          valor_total: args.valor_total,
          status: "aberta",
          observacoes: args.observacoes || null,
          created_by: userId,
        })
        .select("id, numero, valor_total")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, summary: `Medição #${data.numero} de ${obra.name} (R$ ${brl(data.valor_total)}).`, data };
    }

    // ===== Relatórios =====
    case "fluxo_caixa": {
      const ate = args.ate || new Date().toISOString().slice(0, 10);
      const desde = args.desde || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      let q = supabase
        .from("lancamentos")
        .select("tipo, valor, obra_id")
        .eq("customer_id", customerId)
        .gte("data", desde)
        .lte("data", ate);
      if (args.obra_nome) {
        const o = await findObra(supabase, customerId, args.obra_nome);
        q = q.eq("obra_id", o.id);
      }
      const { data } = await q;
      let entradas = 0, saidas = 0;
      for (const l of data || []) {
        if (l.tipo === "entrada") entradas += Number(l.valor);
        else if (l.tipo === "saida") saidas += Number(l.valor);
      }
      const saldo = entradas - saidas;
      return {
        ok: true,
        summary: `${desde} → ${ate}: entradas R$ ${brl(entradas)}, saídas R$ ${brl(saidas)}, saldo R$ ${brl(saldo)}.`,
        data: { desde, ate, entradas, saidas, saldo },
      };
    }
    case "dashboard_geral": {
      const hoje = new Date().toISOString().slice(0, 10);
      const [bancos, cpAtrasadas, crAtrasadas, obras, proximas] = await Promise.all([
        supabase.from("contas_bancarias").select("saldo_atual").eq("customer_id", customerId).eq("ativo", true),
        supabase.from("contas_pagar").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("status", "pendente").lt("vencimento", hoje),
        supabase.from("contas_receber").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("status", "pendente").lt("vencimento", hoje),
        supabase.from("obras").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("status", "ativa"),
        supabase.from("contas_pagar").select("descricao, valor, vencimento").eq("customer_id", customerId).eq("status", "pendente").gte("vencimento", hoje).order("vencimento").limit(5),
      ]);
      const saldoTotal = (bancos.data || []).reduce((s: number, b: any) => s + Number(b.saldo_atual || 0), 0);
      return {
        ok: true,
        summary: `Saldo bancos: R$ ${brl(saldoTotal)}. Obras ativas: ${obras.count}. Contas a pagar atrasadas: ${cpAtrasadas.count}. Contas a receber atrasadas: ${crAtrasadas.count}.`,
        data: { saldoTotal, obrasAtivas: obras.count, cpAtrasadas: cpAtrasadas.count, crAtrasadas: crAtrasadas.count, proximas: proximas.data },
      };
    }
    case "relatorio_obra": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
      const { data: etapas } = await supabase
        .from("orcamento_etapas")
        .select("nome, percentual, orcamento_subetapas(nome, valor_orcado)")
        .eq("obra_id", obra.id)
        .order("ordem");
      const { data: compras } = await supabase
        .from("compras")
        .select("valor_total")
        .eq("obra_id", obra.id)
        .neq("status", "cancelada");
      const realizado = (compras || []).reduce((s: number, c: any) => s + Number(c.valor_total || 0), 0);
      const orcado = (etapas || []).reduce(
        (s: number, e: any) => s + (e.orcamento_subetapas || []).reduce((x: number, sub: any) => x + Number(sub.valor_orcado || 0), 0),
        0,
      );
      const saldo = orcado - realizado;
      return {
        ok: true,
        summary: `${obra.name}: orçado R$ ${brl(orcado)} | realizado R$ ${brl(realizado)} | saldo R$ ${brl(saldo)} (${etapas?.length ?? 0} etapas).`,
        data: { obra, orcado, realizado, saldo, etapas },
      };
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

// ---------- Server Functions ----------
type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[] }) => input)
  .handler(async ({ data, context }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY não configurada no servidor");
    const { supabase, userId } = context;
    const customerId = await getCustomerId(supabase, userId);
    if (!(await isEmpresarial(supabase, customerId))) {
      throw new Error("Recurso disponível apenas no plano Empresarial");
    }

    await chargeCredits(supabase, customerId, userId, "chat_message", "Mensagem ao assistente");

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.messages,
    ];

    for (let i = 0; i < 5; i++) {
      const resp = await fetch(`${OPENAI_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
        if (resp.status === 402) throw new Error("Créditos de IA esgotados. Contate o administrador.");
        throw new Error(`IA ${resp.status}: ${txt.slice(0, 200)}`);
      }
      const json = await resp.json();
      const choice = json.choices?.[0]?.message;
      if (!choice) throw new Error("Resposta vazia da IA");

      const toolCalls = choice.tool_calls as any[] | undefined;
      if (!toolCalls || toolCalls.length === 0) {
        return {
          type: "message" as const,
          text: choice.content ?? "",
          messages: [...data.messages, { role: "assistant" as const, content: choice.content ?? "" }],
        };
      }

      const proposals = toolCalls.filter((tc) => MUTATING_TOOLS.has(tc.function.name));
      const reads = toolCalls.filter((tc) => !MUTATING_TOOLS.has(tc.function.name));

      if (proposals.length > 0) {
        return {
          type: "proposal" as const,
          text: choice.content ?? "",
          proposals: proposals.map((tc) => ({
            id: tc.id,
            tool: tc.function.name,
            args: JSON.parse(tc.function.arguments || "{}"),
          })),
          assistantMessage: choice,
          messages: data.messages,
        };
      }

      messages.push(choice);
      for (const tc of reads) {
        try {
          const args = JSON.parse(tc.function.arguments || "{}");
          const res = await executeTool(supabase, customerId, userId, tc.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(res),
          });
        } catch (e: any) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify({ ok: false, error: e.message }),
          });
        }
      }
    }
    throw new Error("Loop de tool calls excedeu o limite");
  });

export const aiExecuteAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tool: string; args: any }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const customerId = await getCustomerId(supabase, userId);
    if (!(await isEmpresarial(supabase, customerId))) {
      throw new Error("Recurso disponível apenas no plano Empresarial");
    }
    if (!MUTATING_TOOLS.has(data.tool)) {
      throw new Error("Ferramenta não permitida");
    }
    const charge = await chargeCredits(
      supabase,
      customerId,
      userId,
      data.tool,
      `Ação IA: ${data.tool}`,
    );
    try {
      const result = await executeTool(supabase, customerId, userId, data.tool, data.args);
      return { ...result, credits: charge };
    } catch (e) {
      if (charge.charged > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await applyCreditDelta(supabaseAdmin, {
          customerId,
          delta: charge.charged,
          tipo: "estorno",
          actionKey: data.tool,
          descricao: `Estorno por falha em ${data.tool}`,
          userId,
        });
      }
      throw e;
    }
  });

export const aiTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; mime: string }) => input)
  .handler(async ({ data, context }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY não configurada");
    const { supabase, userId } = context;
    const customerId = await getCustomerId(supabase, userId);
    if (!(await isEmpresarial(supabase, customerId))) {
      throw new Error("Recurso disponível apenas no plano Empresarial");
    }

    await chargeCredits(supabase, customerId, userId, "transcribe_audio", "Transcrição de áudio");

    const bin = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const ext = data.mime.includes("mp4") ? "m4a" : data.mime.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", new Blob([bin], { type: data.mime }), `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "pt");
    form.append("response_format", "json");

    const resp = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Whisper ${resp.status}: ${txt.slice(0, 200)}`);
    }
    const json = await resp.json();
    return { text: (json.text ?? "") as string };
  });
