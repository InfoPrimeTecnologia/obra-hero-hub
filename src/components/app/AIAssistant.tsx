import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Mic, Square, Loader2, X, Check, XCircle, Coins } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aiChat, aiExecuteAction, aiTranscribe } from "@/lib/ai-assistant.functions";
import { getMyCredits } from "@/lib/credits.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | {
      role: "proposal";
      text: string;
      proposals: { id: string; tool: string; args: any }[];
      assistantMessage: any;
      status: "pending" | "executing" | "done" | "cancelled";
      results?: { ok: boolean; summary: string }[];
    };

const TOOL_LABELS: Record<string, string> = {
  create_obra: "Criar obra",
  update_obra: "Atualizar obra",
  archive_obra: "Arquivar obra",
  create_etapa: "Criar etapa",
  create_subetapa: "Criar subetapa",
  update_subetapa: "Atualizar subetapa",
  delete_etapa: "Excluir etapa",
  delete_subetapa: "Excluir subetapa",
  create_compra: "Registrar compra",
  cancel_compra: "Cancelar compra",
  create_rdo: "Criar RDO",
  add_rdo_equipe: "Equipe no RDO",
  add_rdo_atividade: "Atividade no RDO",
  add_rdo_ocorrencia: "Ocorrência no RDO",
  create_conta_pagar: "Conta a pagar",
  create_conta_receber: "Conta a receber",
  pagar_conta: "Pagar conta",
  receber_conta: "Receber conta",
  create_conta_bancaria: "Criar conta bancária",
  create_transferencia: "Transferência",
  create_cartao: "Criar cartão",
  pagar_fatura_cartao: "Pagar fatura",
  create_fornecedor: "Criar fornecedor",
  update_fornecedor: "Atualizar fornecedor",
  create_categoria: "Criar categoria",
  create_empresa: "Criar empresa",
  create_produto: "Criar produto",
  create_almoxarifado: "Criar almoxarifado",
  movimentar_estoque: "Movimentar estoque",
  create_requisicao: "Criar requisição",
  create_colaborador: "Cadastrar colaborador",
  vincular_colaborador_obra: "Vincular colaborador",
  desligar_colaborador: "Desligar colaborador",
  create_medicao: "Criar medição",
};

const brl = (n: any) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

function summarizeArgs(tool: string, args: any): string {
  switch (tool) {
    case "create_obra":
      return `${args.nome}${args.cidade ? ` — ${args.cidade}/${args.estado || ""}` : ""}`;
    case "update_obra":
      return `${args.obra_nome}${args.novo_nome ? ` → ${args.novo_nome}` : ""}`;
    case "archive_obra":
      return `${args.obra_nome} (${args.arquivar ? "arquivar" : "reativar"})`;
    case "create_etapa":
      return `${args.nome} em ${args.obra_nome}`;
    case "create_subetapa":
      return `${args.nome} (R$ ${brl(args.valor_orcado)}) em ${args.etapa_nome}`;
    case "update_subetapa":
      return `${args.subetapa_nome}${args.novo_valor !== undefined ? ` → R$ ${brl(args.novo_valor)}` : ""}${args.percentual !== undefined ? ` — ${args.percentual}%` : ""}`;
    case "delete_etapa":
      return `${args.etapa_nome} em ${args.obra_nome}`;
    case "delete_subetapa":
      return `${args.subetapa_nome} (${args.etapa_nome})`;
    case "create_compra":
      return `${args.descricao} — R$ ${brl(args.valor_total)} (${args.forma_pagamento}) em ${args.obra_nome} › ${args.etapa_nome ?? "?"} › ${args.subetapa_nome ?? "?"}`;
    case "cancel_compra":
      return `Compra ${args.compra_id}`;
    case "create_rdo":
      return `${args.obra_nome} em ${args.data || "hoje"} — ${args.condicao}`;
    case "add_rdo_equipe":
      return `${args.quantidade}× ${args.funcao} (${args.horas}h) em ${args.obra_nome}`;
    case "add_rdo_atividade":
      return `${args.descricao} (${args.obra_nome})`;
    case "add_rdo_ocorrencia":
      return `${args.tipo}: ${args.descricao} — ${args.obra_nome}`;
    case "create_conta_pagar":
      return `${args.descricao} — R$ ${brl(args.valor)} vence ${args.vencimento}`;
    case "create_conta_receber":
      return `${args.descricao} — R$ ${brl(args.valor)} vence ${args.vencimento}`;
    case "pagar_conta":
      return `${args.descricao_busca} via ${args.conta_bancaria_nome}`;
    case "receber_conta":
      return `${args.descricao_busca} em ${args.conta_bancaria_nome}`;
    case "create_conta_bancaria":
      return `${args.nome} (${args.tipo})`;
    case "create_transferencia":
      return `R$ ${brl(args.valor)}: ${args.conta_origem_nome} → ${args.conta_destino_nome}`;
    case "create_cartao":
      return `${args.nome} — limite R$ ${brl(args.limite)}, fecha dia ${args.dia_fechamento}, vence dia ${args.dia_vencimento}`;
    case "pagar_fatura_cartao":
      return `${args.cartao_nome} ${args.competencia}${args.conta_bancaria_nome ? ` via ${args.conta_bancaria_nome}` : ""}`;
    case "create_fornecedor":
      return `${args.nome}${args.cpf_cnpj ? ` (${args.cpf_cnpj})` : ""}`;
    case "update_fornecedor":
      return `${args.nome_busca}${args.novo_nome ? ` → ${args.novo_nome}` : ""}`;
    case "create_categoria":
      return `${args.nome} (${args.tipo})`;
    case "create_empresa":
      return `${args.nome}${args.cnpj ? ` (${args.cnpj})` : ""}`;
    case "create_produto":
      return `${args.nome} (${args.unidade})`;
    case "create_almoxarifado":
      return `${args.nome}${args.obra_nome ? ` — ${args.obra_nome}` : ""}`;
    case "movimentar_estoque":
      return `${args.tipo} de ${args.quantidade} ${args.produto_nome} em ${args.almoxarifado_nome}`;
    case "create_requisicao":
      return `Requisição em ${args.obra_nome} (${args.itens?.length || 0} itens)`;
    case "create_colaborador":
      return `${args.nome} — ${args.vinculo} R$ ${brl(args.remuneracao)}`;
    case "vincular_colaborador_obra":
      return `${args.colaborador_nome} → ${args.obra_nome}`;
    case "desligar_colaborador":
      return `${args.colaborador_nome} em ${args.data_saida || "hoje"}`;
    case "create_medicao":
      return `${args.obra_nome} — R$ ${brl(args.valor_total)}`;
    default:
      return JSON.stringify(args);
  }
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const chat = useServerFn(aiChat);
  const execAction = useServerFn(aiExecuteAction);
  const transcribe = useServerFn(aiTranscribe);
  const getCredits = useServerFn(getMyCredits);
  const qc = useQueryClient();
  const credits = useQuery({
    queryKey: ["my-credits"],
    queryFn: () => getCredits(),
    enabled: open,
    staleTime: 15_000,
    retry: 1,
  });
  const saldo = credits.data?.saldo ?? 0;
  function refreshCredits() {
    qc.invalidateQueries({ queryKey: ["my-credits"] });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 100);
  }, [open]);

  // Build the conversation history to send to the API (only role+content, no proposals)
  function historyForApi(): any[] {
    const out: any[] = [];
    for (const m of messages) {
      if (m.role === "user") out.push({ role: "user", content: m.content });
      else if (m.role === "assistant") out.push({ role: "assistant", content: m.content });
      // proposals are internal to the UI; if confirmed we'll append a synthetic assistant msg below
      else if (m.role === "proposal" && m.status === "done") {
        const summary = m.results?.map((r) => r.summary).join(" ") ?? "";
        out.push({
          role: "assistant",
          content: (m.text ? m.text + "\n" : "") + summary,
        });
      } else if (m.role === "proposal" && m.status === "cancelled") {
        out.push({ role: "assistant", content: m.text || "" });
        out.push({ role: "user", content: "(cancelei a ação anterior)" });
      }
    }
    return out;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const history = [...historyForApi(), { role: "user", content: trimmed }];
      const res: any = await chat({ data: { messages: history } });
      if (res.type === "message") {
        setMessages((m) => [...m, { role: "assistant", content: res.text || "" }]);
      } else if (res.type === "proposal") {
        setMessages((m) => [
          ...m,
          {
            role: "proposal",
            text: res.text || "",
            proposals: res.proposals,
            assistantMessage: res.assistantMessage,
            status: "pending",
          },
        ]);
      }
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
      setMessages((m) => [...m, { role: "assistant", content: `❌ ${e.message}` }]);
    } finally {
      setBusy(false);
      refreshCredits();
    }
  }

  async function confirmProposal(idx: number) {
    const msg = messages[idx];
    if (msg.role !== "proposal" || msg.status !== "pending") return;
    setMessages((all) => all.map((m, i) => (i === idx ? { ...m, status: "executing" } : m)));
    const results: { ok: boolean; summary: string }[] = [];
    try {
      for (const p of msg.proposals) {
        try {
          const r: any = await execAction({ data: { tool: p.tool, args: p.args } });
          results.push({ ok: true, summary: r.summary });
        } catch (e: any) {
          results.push({ ok: false, summary: `❌ ${e.message}` });
        }
      }
      setMessages((all) =>
        all.map((m, i) => (i === idx ? { ...(m as any), status: "done", results } : m)),
      );
      const okCount = results.filter((r) => r.ok).length;
      toast.success(`${okCount}/${results.length} ação(ões) concluída(s)`);
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally {
      refreshCredits();
    }
  }

  function cancelProposal(idx: number) {
    setMessages((all) => all.map((m, i) => (i === idx ? { ...(m as any), status: "cancelled" } : m)));
  }

  async function toggleMic() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (blob.size === 0) return;
        setBusy(true);
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          const chunk = 0x8000;
          for (let i = 0; i < buf.length; i += chunk) {
            bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
          }
          const b64 = btoa(bin);
          const { text } = await transcribe({ data: { audioBase64: b64, mime: rec.mimeType } });
          setBusy(false);
          if (text.trim()) await send(text);
        } catch (e: any) {
          setBusy(false);
          toast.error("Erro na transcrição", { description: e.message });
        }
      };
      rec.start();
      setRecording(true);
    } catch (e: any) {
      toast.error("Microfone indisponível", { description: e.message });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Assistente de IA"
        title="Assistente Mestre360 (IA)"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[420px] max-w-[calc(100vw-3rem)] flex-col rounded-xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Assistente Mestre360</p>
              <Badge variant="secondary" className="text-xs">IA</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/app/creditos"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                  saldo < 5
                    ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
                )}
                title="Créditos disponíveis"
              >
                <Coins className="h-3 w-3" />
                {saldo}
              </Link>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {saldo === 0 && (
            <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs">
              <p className="text-destructive">
                Você está sem créditos.{" "}
                <Link to="/app/creditos" className="font-semibold underline">
                  Recarregue agora
                </Link>{" "}
                para continuar usando o assistente.
              </p>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.length === 0 && (
              <div className="text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Olá! 👷 Como posso ajudar?</p>
                <p className="mb-1">Exemplos:</p>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  <li>"Crie uma etapa Fundações na obra Casa Vila"</li>
                  <li>"Registre compra de 50 sacos de cimento R$ 1.800 boleto na obra X"</li>
                  <li>"Faça o RDO de hoje na obra Y, trabalhada, concretagem da laje"</li>
                  <li>"Conta a pagar IPTU R$ 350 vence 15/07"</li>
                </ul>
                <p className="mt-3 text-xs">
                  Cada mensagem consome créditos conforme a complexidade da ação (1 para chat,
                  até 8 para registrar compra).
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === "user")
                return (
                  <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                    {m.content}
                  </div>
                );
              if (m.role === "assistant")
                return (
                  <div key={i} className="max-w-[85%] whitespace-pre-wrap text-foreground">
                    {m.content}
                  </div>
                );
              // proposal
              return (
                <Card key={i} className="border-primary/30 bg-primary/5 p-3">
                  {m.text && <p className="mb-2 whitespace-pre-wrap">{m.text}</p>}
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Confirmar ação{m.proposals.length > 1 ? "ões" : ""}:
                  </p>
                  <ul className="mb-3 space-y-1.5">
                    {m.proposals.map((p) => (
                      <li key={p.id} className="text-xs">
                        <Badge variant="outline" className="mr-1.5">{TOOL_LABELS[p.tool] || p.tool}</Badge>
                        {summarizeArgs(p.tool, p.args)}
                      </li>
                    ))}
                  </ul>
                  {m.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmProposal(i)} className="gap-1">
                        <Check className="h-3.5 w-3.5" /> Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelProposal(i)} className="gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>
                  )}
                  {m.status === "executing" && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Executando...
                    </p>
                  )}
                  {m.status === "done" && (
                    <ul className="space-y-1 text-xs">
                      {m.results?.map((r, j) => (
                        <li key={j} className={cn(r.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                          {r.ok ? "✓ " : ""}{r.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.status === "cancelled" && (
                    <p className="text-xs text-muted-foreground">Cancelado.</p>
                  )}
                </Card>
              );
            })}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                ref={taRef}
                rows={2}
                placeholder="Digite ou clique no microfone..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                disabled={busy || recording}
                className="resize-none text-sm"
              />
              <div className="flex flex-col gap-1.5">
                <Button
                  size="icon"
                  variant={recording ? "destructive" : "outline"}
                  onClick={toggleMic}
                  disabled={busy && !recording}
                  title={recording ? "Parar gravação" : "Gravar voz"}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button size="icon" onClick={() => void send(input)} disabled={busy || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {recording && (
              <p className="mt-1.5 text-xs text-destructive">● Gravando... clique no quadrado para parar.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
