import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPENAI_URL = "https://api.openai.com/v1";
const MODEL = "gpt-4o-mini";

// ---------- Tool catalog (OpenAI function calling) ----------
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_obras",
      description: "Lista as obras ativas do usuário (id e nome).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_etapa",
      description: "Cria uma nova etapa de orçamento dentro de uma obra.",
      parameters: {
        type: "object",
        properties: {
          obra_nome: { type: "string", description: "Nome da obra (será buscado por similaridade)" },
          nome: { type: "string" },
        },
        required: ["obra_nome", "nome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_subetapa",
      description: "Cria uma subetapa (item de orçamento) dentro de uma etapa existente.",
      parameters: {
        type: "object",
        properties: {
          obra_nome: { type: "string" },
          etapa_nome: { type: "string" },
          nome: { type: "string" },
          valor_orcado: { type: "number" },
        },
        required: ["obra_nome", "etapa_nome", "nome", "valor_orcado"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_compra",
      description: "Registra uma compra/pedido para uma obra. O valor total é obrigatório.",
      parameters: {
        type: "object",
        properties: {
          obra_nome: { type: "string" },
          fornecedor_nome: { type: "string", description: "Opcional. Será criado se não existir." },
          descricao: { type: "string" },
          valor_total: { type: "number" },
          forma_pagamento: { type: "string", enum: ["dinheiro", "pix", "boleto", "cartao", "transferencia"] },
          qtd_parcelas: { type: "integer", minimum: 1 },
          data_compra: { type: "string", description: "YYYY-MM-DD; default hoje" },
        },
        required: ["obra_nome", "descricao", "valor_total", "forma_pagamento"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_rdo",
      description: "Cria um Diário de Obra (RDO) para uma obra em uma data específica.",
      parameters: {
        type: "object",
        properties: {
          obra_nome: { type: "string" },
          data: { type: "string", description: "YYYY-MM-DD; default hoje" },
          condicao: { type: "string", enum: ["trabalhada", "parcial", "parada"] },
          clima: { type: "string", description: "Resumo do clima do dia" },
          atividade: { type: "string", description: "Descrição da atividade principal realizada (opcional)" },
          observacoes: { type: "string" },
        },
        required: ["obra_nome", "condicao"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_conta_pagar",
      description: "Cria uma conta a pagar (despesa).",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          valor: { type: "number" },
          vencimento: { type: "string", description: "YYYY-MM-DD" },
          obra_nome: { type: "string" },
          fornecedor_nome: { type: "string" },
          categoria_nome: { type: "string" },
        },
        required: ["descricao", "valor", "vencimento"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_conta_receber",
      description: "Cria uma conta a receber (receita).",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          valor: { type: "number" },
          vencimento: { type: "string", description: "YYYY-MM-DD" },
          obra_nome: { type: "string" },
          categoria_nome: { type: "string" },
        },
        required: ["descricao", "valor", "vencimento"],
        additionalProperties: false,
      },
    },
  },
];

// Ações que mutam dados → exigem confirmação do usuário
const MUTATING_TOOLS = new Set([
  "create_etapa",
  "create_subetapa",
  "create_compra",
  "create_rdo",
  "create_conta_pagar",
  "create_conta_receber",
]);

const SYSTEM_PROMPT = `Você é o assistente do Mestre360, um ERP para construção civil.

Seu papel:
- Ajudar o usuário a criar e gerenciar orçamentos, compras, diários de obra (RDO), contas a pagar e contas a receber.
- Tirar dúvidas sobre o uso da plataforma.
- Quando o usuário pedir algo que envolva criar/editar dados, USE as ferramentas (function calls). Não invente respostas dizendo "fiz isso" sem ter chamado a função.
- Sempre fale em português do Brasil, com tom direto, simpático e objetivo (mestre de obras, engenheiro).
- Datas: use YYYY-MM-DD. Se o usuário disser "hoje", "amanhã", "sexta", calcule com base em ${new Date().toISOString().slice(0, 10)} (timezone America/Sao_Paulo).
- Valores em reais: aceite "5 mil", "R$ 5.000", "5000,50" e converta para número decimal com ponto.
- Antes de criar coisas com valores ou para a obra errada, prefira confirmar com o usuário se ambíguo.
- Se faltar uma informação obrigatória (ex: qual obra), pergunte antes de chamar a função.
- Você pode chamar list_obras a qualquer momento para descobrir as obras do cliente.`;

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
  const n = nome.trim();
  const { data } = await supabase
    .from("obras")
    .select("id, name")
    .eq("customer_id", customerId)
    .ilike("name", `%${n}%`)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error(`Obra "${nome}" não encontrada`);
  return data as { id: string; name: string };
}

async function findOrCreateFornecedor(
  supabase: any,
  customerId: string,
  userId: string,
  nome: string,
) {
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

// ---------- Executors ----------
async function executeTool(
  supabase: any,
  customerId: string,
  userId: string,
  name: string,
  args: any,
): Promise<{ ok: boolean; summary: string; data?: any }> {
  switch (name) {
    case "list_obras": {
      const { data } = await supabase
        .from("obras")
        .select("id, name, status")
        .eq("customer_id", customerId)
        .neq("status", "arquivada")
        .order("name");
      return {
        ok: true,
        summary: `${data?.length ?? 0} obras encontradas.`,
        data: data ?? [],
      };
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
      const { data: etapa } = await supabase
        .from("orcamento_etapas")
        .select("id, nome")
        .eq("obra_id", obra.id)
        .ilike("nome", `%${args.etapa_nome}%`)
        .limit(1)
        .maybeSingle();
      if (!etapa) throw new Error(`Etapa "${args.etapa_nome}" não encontrada em ${obra.name}`);
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
        summary: `Subetapa "${data.nome}" (R$ ${Number(data.valor_orcado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) criada em "${etapa.nome}".`,
        data,
      };
    }
    case "create_compra": {
      const obra = await findObra(supabase, customerId, args.obra_nome);
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
        summary: `Compra "${data.descricao}" registrada em ${obra.name} (R$ ${Number(data.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
        data,
      };
    }
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
      return {
        ok: true,
        summary: `RDO de ${dataRdo} criado para ${obra.name} (${args.condicao}).`,
        data: rdo,
      };
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
          status: "aberta",
          origem: "manual",
          created_by: userId,
        })
        .select("id, descricao, valor, vencimento")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        summary: `Conta a pagar "${data.descricao}" criada — R$ ${Number(data.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vencendo em ${data.vencimento}.`,
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
          status: "aberta",
          origem: "manual",
          created_by: userId,
        })
        .select("id, descricao, valor, vencimento")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        summary: `Conta a receber "${data.descricao}" criada — R$ ${Number(data.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vencendo em ${data.vencimento}.`,
        data,
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
    if (!key) throw new Error("OPENAI_API_KEY não configurada");
    const { supabase, userId } = context;
    const customerId = await getCustomerId(supabase, userId);
    if (!(await isEmpresarial(supabase, customerId))) {
      throw new Error("Recurso disponível apenas no plano Empresarial");
    }

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.messages,
    ];

    // Loop: enquanto vier tool_call de leitura (list_obras), executamos e continuamos.
    // Tool calls que mutam são devolvidas ao cliente como "proposals" para confirmar.
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
        throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 200)}`);
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

      // Separa: ações que mutam ficam como propostas; leituras executamos
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

      // Executa leituras e continua o loop
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
    return await executeTool(supabase, customerId, userId, data.tool, data.args);
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
