import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload, FileSpreadsheet, Check, Link2, Unlink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/conciliacao")({
  component: ConciliacaoPage,
});

type Item = {
  id: string; data: string; descricao: string | null; valor: number;
  tipo: string; lancamento_id: string | null; match_status: string;
};
type Lanc = { id: string; data: string; descricao: string; valor: number; tipo: string; conta_bancaria_id: string };

// OFX/CSV parser (simples)
function parseOFX(text: string) {
  const items: Array<{ data: string; descricao: string; valor: number; tipo: string }> = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const get = (tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`))?.[1]?.trim();
    const dt = get("DTPOSTED") ?? "";
    const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    const valor = Number(get("TRNAMT") ?? 0);
    items.push({
      data, descricao: get("MEMO") ?? get("NAME") ?? "",
      valor: Math.abs(valor), tipo: valor >= 0 ? "entrada" : "saida",
    });
  }
  return items;
}
function parseCSV(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const items: Array<{ data: string; descricao: string; valor: number; tipo: string }> = [];
  // formato esperado: data,descricao,valor (valor negativo = saída)
  for (let i = 1; i < lines.length; i++) {
    const [data, descricao, valorStr] = lines[i].split(",");
    if (!data) continue;
    const v = Number((valorStr ?? "0").replace(",", "."));
    items.push({ data: data.trim(), descricao: (descricao ?? "").trim(), valor: Math.abs(v), tipo: v >= 0 ? "entrada" : "saida" });
  }
  return items;
}

function ConciliacaoPage() {
  const { user } = useAuth();
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contaId, setContaId] = useState("");
  const [extratos, setExtratos] = useState<{ id: string; arquivo_nome: string | null; created_at: string; status: string }[]>([]);
  const [extratoAtivo, setExtratoAtivo] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [busy, setBusy] = useState(false);

  const carregar = async () => {
    const { data } = await supabase.from("contas_bancarias").select("id,nome").eq("ativo", true);
    setContas((data ?? []) as any);
    const { data: ext } = await supabase.from("conciliacao_extratos").select("*").order("created_at", { ascending: false });
    setExtratos((ext ?? []) as any);
  };
  useEffect(() => { void carregar(); }, []);

  const carregarItens = async (extId: string) => {
    setExtratoAtivo(extId);
    const { data } = await supabase.from("conciliacao_itens").select("*").eq("extrato_id", extId).order("data");
    setItens((data ?? []) as Item[]);
    const ext = extratos.find(e => e.id === extId);
    if (ext) {
      const { data: l } = await supabase.from("lancamentos").select("*").order("data", { ascending: false }).limit(500);
      setLancs((l ?? []) as Lanc[]);
    }
  };

  const importar = async (file: File) => {
    if (!contaId) return toast.error("Selecione a conta bancária");
    setBusy(true);
    try {
      const text = await file.text();
      const isOFX = file.name.toLowerCase().endsWith(".ofx") || text.includes("<STMTTRN>");
      const items = isOFX ? parseOFX(text) : parseCSV(text);
      if (items.length === 0) { setBusy(false); return toast.error("Nenhuma linha encontrada"); }
      const { data: customer } = await supabase
        .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
      if (!customer) { setBusy(false); return toast.error("Conta não identificada"); }
      const { data: ext, error } = await supabase.from("conciliacao_extratos").insert({
        customer_id: customer.id, conta_bancaria_id: contaId,
        arquivo_nome: file.name, formato: isOFX ? "ofx" : "csv",
        periodo_inicio: items[0].data, periodo_fim: items[items.length - 1].data,
        created_by: user!.id,
      }).select().single();
      if (error || !ext) { setBusy(false); return toast.error(error?.message || "Erro"); }
      const rows = items.map(it => ({
        customer_id: customer.id, extrato_id: ext.id, ...it,
      }));
      await supabase.from("conciliacao_itens").insert(rows);
      toast.success(`${items.length} linhas importadas`);
      await carregar();
      await carregarItens(ext.id);
    } finally { setBusy(false); }
  };

  const tentarMatch = (item: Item) => {
    // sugere por data exata + valor exato
    return lancs.find(l => l.data === item.data && Math.abs(Number(l.valor) - Number(item.valor)) < 0.01);
  };

  const conciliar = async (item: Item, lancId: string) => {
    await supabase.from("conciliacao_itens").update({ lancamento_id: lancId, match_status: "conciliado" }).eq("id", item.id);
    await supabase.from("lancamentos").update({ conciliado: true }).eq("id", lancId);
    if (extratoAtivo) await carregarItens(extratoAtivo);
  };
  const desconciliar = async (item: Item) => {
    if (item.lancamento_id) await supabase.from("lancamentos").update({ conciliado: false }).eq("id", item.lancamento_id);
    await supabase.from("conciliacao_itens").update({ lancamento_id: null, match_status: "pendente" }).eq("id", item.id);
    if (extratoAtivo) await carregarItens(extratoAtivo);
  };

  return (
    <div>
      <PageHeader
        title="Conciliação bancária"
        info="Confere lançamentos do sistema com o extrato bancário, marcando o que já foi conciliado."
        description="Importe OFX/CSV e bata contra os lançamentos"
      />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="font-semibold">Importar extrato</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label>Conta bancária</Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Arquivo OFX ou CSV</Label>
                <Input type="file" accept=".ofx,.csv,.txt" disabled={busy}
                  onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">CSV: data,descricao,valor (valor negativo = saída).</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 font-semibold">Extratos importados</h3>
            {extratos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum extrato.</p>
            ) : extratos.map(e => (
              <div key={e.id} className="flex items-center justify-between border-b py-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span>{e.arquivo_nome}</span>
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => carregarItens(e.id)}>Abrir</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {extratoAtivo && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold">Linhas do extrato</h3>
              <div className="space-y-2">
                {itens.map(it => {
                  const sugestao = tentarMatch(it);
                  return (
                    <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-2 text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant={it.tipo === "entrada" ? "default" : "secondary"}>{it.tipo}</Badge>
                        <span>{new Date(it.data).toLocaleDateString("pt-BR")}</span>
                        <span className="text-muted-foreground">{it.descricao}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">R$ {Number(it.valor).toFixed(2)}</span>
                        {it.match_status === "conciliado" ? (
                          <>
                            <Badge variant="default"><Check className="mr-1 h-3 w-3" /> Conciliado</Badge>
                            <Button size="sm" variant="ghost" onClick={() => desconciliar(it)}>
                              <Unlink className="h-4 w-4" />
                            </Button>
                          </>
                        ) : sugestao ? (
                          <Button size="sm" onClick={() => conciliar(it, sugestao.id)}>
                            <Link2 className="mr-1 h-4 w-4" /> Conciliar
                          </Button>
                        ) : (
                          <Badge variant="outline">Sem match</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
