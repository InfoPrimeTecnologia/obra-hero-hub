import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/medicoes")({
  component: MedicoesPage,
});

type Medicao = {
  id: string;
  numero: number;
  data: string;
  observacoes: string | null;
  valor_total: number;
  status: string;
};

type Subetapa = {
  id: string;
  nome: string;
  valor_orcado: number;
  etapa_id: string;
  etapa_nome: string;
};

type ItemMed = {
  subetapa_id: string;
  descricao: string;
  percentual: number;
  valor: number;
  valor_orcado: number;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MedicoesPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [subetapas, setSubetapas] = useState<Subetapa[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [dataMed, setDataMed] = useState(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<ItemMed[]>([]);

  const carregar = async () => {
    const [obraRes, medRes, etapasRes] = await Promise.all([
      supabase.from("obras").select("customer_id").eq("id", obraId).maybeSingle(),
      supabase
        .from("medicoes_obra")
        .select("id,numero,data,observacoes,valor_total,status")
        .eq("obra_id", obraId)
        .order("numero", { ascending: false }),
      supabase
        .from("orcamento_etapas")
        .select("id,nome,orcamento_subetapas(id,nome,valor_orcado)")
        .eq("obra_id", obraId)
        .order("ordem"),
    ]);
    setCustomerId(obraRes.data?.customer_id ?? null);
    setMedicoes((medRes.data ?? []) as Medicao[]);
    const subs: Subetapa[] = [];
    (etapasRes.data ?? []).forEach((e: any) => {
      (e.orcamento_subetapas ?? []).forEach((s: any) => {
        subs.push({
          id: s.id,
          nome: s.nome,
          valor_orcado: Number(s.valor_orcado || 0),
          etapa_id: e.id,
          etapa_nome: e.nome,
        });
      });
    });
    setSubetapas(subs);
  };

  useEffect(() => {
    void carregar();
  }, [obraId]);

  const novaMedicao = () => {
    setItens(
      subetapas.map((s) => ({
        subetapa_id: s.id,
        descricao: `${s.etapa_nome} / ${s.nome}`,
        percentual: 0,
        valor: 0,
        valor_orcado: s.valor_orcado,
      })),
    );
    setDataMed(new Date().toISOString().slice(0, 10));
    setObs("");
    setOpen(true);
  };

  const updItem = (idx: number, perc: number) => {
    setItens((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, percentual: perc, valor: (it.valor_orcado * perc) / 100 } : it,
      ),
    );
  };

  const total = useMemo(() => itens.reduce((s, it) => s + it.valor, 0), [itens]);

  const salvar = async () => {
    if (!customerId || !user) return;
    setSaving(true);
    const proxNum = (medicoes[0]?.numero ?? 0) + 1;
    const { data: med, error } = await supabase
      .from("medicoes_obra")
      .insert({
        customer_id: customerId,
        obra_id: obraId,
        data: dataMed,
        numero: proxNum,
        observacoes: obs || null,
        valor_total: total,
        status: "aberta",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !med) {
      setSaving(false);
      toast.error("Erro ao salvar", { description: error?.message });
      return;
    }
    const itensIns = itens
      .filter((it) => it.percentual > 0)
      .map((it) => ({
        customer_id: customerId,
        medicao_obra_id: med.id,
        subetapa_id: it.subetapa_id,
        descricao: it.descricao,
        percentual: it.percentual,
        valor: it.valor,
      }));
    if (itensIns.length > 0) {
      const { error: e2 } = await supabase.from("medicao_obra_itens").insert(itensIns);
      if (e2) {
        toast.error("Itens com erro", { description: e2.message });
      }
    }
    setSaving(false);
    setOpen(false);
    toast.success(`Medição #${proxNum} salva`);
    void carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta medição?")) return;
    const { error } = await supabase.from("medicoes_obra").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Medição excluída");
    void carregar();
  };

  return (
    <div>
      <PageHeader
        title="Medições"
        description="Avanço físico por subetapa do orçamento"
        actions={
          <Button onClick={novaMedicao} disabled={subetapas.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Nova medição
          </Button>
        }
      />
      <div className="p-8">
        {subetapas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Cadastre o orçamento da obra antes de criar medições.
            </CardContent>
          </Card>
        ) : medicoes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma medição ainda. Clique em "Nova medição".
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.numero}</TableCell>
                      <TableCell>{m.data}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.observacoes ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(Number(m.valor_total))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => excluir(m.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova medição</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={dataMed} onChange={(e) => setDataMed(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Total da medição</Label>
                <Input value={brl(total)} readOnly className="font-semibold" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>
            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subetapa</TableHead>
                    <TableHead className="text-right">Orçado</TableHead>
                    <TableHead className="w-28 text-right">% Avanço</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it, idx) => (
                    <TableRow key={it.subetapa_id}>
                      <TableCell className="text-sm">{it.descricao}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {brl(it.valor_orcado)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={it.percentual}
                          onChange={(e) => updItem(idx, Number(e.target.value) || 0)}
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {brl(it.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar medição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
