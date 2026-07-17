import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Calendar,
  GripVertical,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/orcamento")({
  component: OrcamentoPage,
});

type Etapa = {
  id: string;
  nome: string;
  ordem: number;
  dt_inicio_prevista: string | null;
  dt_fim_prevista: string | null;
  dt_inicio_real: string | null;
  dt_fim_real: string | null;
  percentual: number;
};

type Subetapa = {
  id: string;
  etapa_id: string;
  nome: string;
  tipo: string | null;
  valor_orcado: number;
  ordem: number;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function OrcamentoPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();

  const [obraNome, setObraNome] = useState<string>("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subs, setSubs] = useState<Subetapa[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [etapaDialog, setEtapaDialog] = useState(false);
  const [editEtapa, setEditEtapa] = useState<Etapa | null>(null);
  const [eNome, setENome] = useState("");
  const [eDtIniPrev, setEDtIniPrev] = useState("");
  const [eDtFimPrev, setEDtFimPrev] = useState("");
  const [eDtIniReal, setEDtIniReal] = useState("");
  const [eDtFimReal, setEDtFimReal] = useState("");
  const [ePercentual, setEPercentual] = useState("0");

  const [subDialog, setSubDialog] = useState(false);
  const [editSub, setEditSub] = useState<Subetapa | null>(null);
  const [subEtapaId, setSubEtapaId] = useState<string>("");
  const [sNome, setSNome] = useState("");
  const [sTipo, setSTipo] = useState("");
  const [sValor, setSValor] = useState("0");

  const carregar = async () => {
    const { data: obra } = await supabase
      .from("obras")
      .select("name")
      .eq("id", obraId)
      .maybeSingle();
    if (obra) setObraNome(obra.name);

    const { data: ets } = await supabase
      .from("orcamento_etapas")
      .select("*")
      .eq("obra_id", obraId)
      .order("ordem")
      .order("created_at");

    const etapasArr = (ets ?? []) as Etapa[];
    setEtapas(etapasArr);

    if (etapasArr.length > 0) {
      const { data: ss } = await supabase
        .from("orcamento_subetapas")
        .select("*")
        .in("etapa_id", etapasArr.map((e) => e.id))
        .order("ordem")
        .order("created_at");
      setSubs((ss ?? []) as Subetapa[]);
    } else {
      setSubs([]);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const totalPorEtapa = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs) {
      map.set(s.etapa_id, (map.get(s.etapa_id) ?? 0) + Number(s.valor_orcado));
    }
    return map;
  }, [subs]);

  const totalGeral = useMemo(
    () => subs.reduce((acc, s) => acc + Number(s.valor_orcado), 0),
    [subs],
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // ---------- Etapa ----------
  const abrirEtapaNova = () => {
    setEditEtapa(null);
    setENome("");
    setEDtIniPrev("");
    setEDtFimPrev("");
    setEDtIniReal("");
    setEDtFimReal("");
    setEPercentual("0");
    setEtapaDialog(true);
  };

  const abrirEtapaEdit = (et: Etapa) => {
    setEditEtapa(et);
    setENome(et.nome);
    setEDtIniPrev(et.dt_inicio_prevista ?? "");
    setEDtFimPrev(et.dt_fim_prevista ?? "");
    setEDtIniReal(et.dt_inicio_real ?? "");
    setEDtFimReal(et.dt_fim_real ?? "");
    setEPercentual(String(et.percentual));
    setEtapaDialog(true);
  };

  const salvarEtapa = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: eNome,
      dt_inicio_prevista: eDtIniPrev || null,
      dt_fim_prevista: eDtFimPrev || null,
      dt_inicio_real: eDtIniReal || null,
      dt_fim_real: eDtFimReal || null,
      percentual: Number(ePercentual) || 0,
    };
    if (editEtapa) {
      const { error } = await supabase
        .from("orcamento_etapas")
        .update(payload)
        .eq("id", editEtapa.id);
      if (error) {
        toast.error("Erro ao salvar etapa", { description: error.message });
        return;
      }
      toast.success("Etapa atualizada");
    } else {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user!.id)
        .maybeSingle();
      if (!customer) {
        toast.error("Não foi possível identificar sua conta.");
        return;
      }
      const novaOrdem = etapas.length;
      const { error } = await supabase.from("orcamento_etapas").insert({
        ...payload,
        customer_id: customer.id,
        obra_id: obraId,
        ordem: novaOrdem,
        created_by: user!.id,
      });
      if (error) {
        toast.error("Erro ao criar etapa", { description: error.message });
        return;
      }
      toast.success("Etapa criada");
    }
    setEtapaDialog(false);
    void carregar();
  };

  const excluirEtapa = async (id: string) => {
    const { error } = await supabase.from("orcamento_etapas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Etapa excluída");
    void carregar();
  };

  // ---------- Subetapa ----------
  const abrirSubNova = (etapaId: string) => {
    setEditSub(null);
    setSubEtapaId(etapaId);
    setSNome("");
    setSTipo("");
    setSValor("0");
    setSubDialog(true);
  };

  const abrirSubEdit = (s: Subetapa) => {
    setEditSub(s);
    setSubEtapaId(s.etapa_id);
    setSNome(s.nome);
    setSTipo(s.tipo ?? "");
    setSValor(String(s.valor_orcado));
    setSubDialog(true);
  };

  const salvarSub = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: sNome,
      tipo: sTipo || null,
      valor_orcado: Number(sValor) || 0,
    };
    if (editSub) {
      const { error } = await supabase
        .from("orcamento_subetapas")
        .update(payload)
        .eq("id", editSub.id);
      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
        return;
      }
      toast.success("Subetapa atualizada");
    } else {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user!.id)
        .maybeSingle();
      if (!customer) {
        toast.error("Não foi possível identificar sua conta.");
        return;
      }
      const ordem = subs.filter((s) => s.etapa_id === subEtapaId).length;
      const { error } = await supabase.from("orcamento_subetapas").insert({
        ...payload,
        customer_id: customer.id,
        etapa_id: subEtapaId,
        ordem,
        created_by: user!.id,
      });
      if (error) {
        toast.error("Erro ao criar", { description: error.message });
        return;
      }
      toast.success("Subetapa criada");
    }
    setSubDialog(false);
    void carregar();
  };

  const excluirSub = async (id: string) => {
    const { error } = await supabase.from("orcamento_subetapas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Subetapa excluída");
    void carregar();
  };

  // ---------- Reorder (drag-and-drop) ----------
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const persistOrdem = async (lista: Etapa[]) => {
    setSaving(true);
    // Two-pass to evitar colidir com unique(obra_id, ordem) durante atualizações
    for (let i = 0; i < lista.length; i++) {
      await supabase
        .from("orcamento_etapas")
        .update({ ordem: -1000 - i })
        .eq("id", lista[i].id);
    }
    for (let i = 0; i < lista.length; i++) {
      await supabase
        .from("orcamento_etapas")
        .update({ ordem: i })
        .eq("id", lista[i].id);
    }
    setSaving(false);
    toast.success("Ordem atualizada");
    void carregar();
  };

  const onDropOn = (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const lista = [...etapas].sort((a, b) => a.ordem - b.ordem);
    const from = lista.findIndex((e) => e.id === sourceId);
    const to = lista.findIndex((e) => e.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = lista.splice(from, 1);
    lista.splice(to, 0, moved);
    setEtapas(lista.map((e, i) => ({ ...e, ordem: i })));
    void persistOrdem(lista);
  };

  return (
    <div>
      <PageHeader
        title="Orçamento"
        description={obraNome ? `Obra: ${obraNome}` : "Estruture o orçamento por etapas e subetapas"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/obras">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/obras/$obraId/gantt" params={{ obraId }}>
                <Calendar className="mr-2 h-4 w-4" /> Gantt
              </Link>
            </Button>
            <Button onClick={abrirEtapaNova}>
              <Plus className="mr-2 h-4 w-4" /> Nova etapa
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">Total orçado</span>
            <span className="text-xl font-semibold">{fmtBRL(totalGeral)}</span>
          </CardContent>
        </Card>

        {etapas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma etapa cadastrada. Clique em "Nova etapa" para começar.
            </CardContent>
          </Card>
        ) : (
          etapas.map((et) => {
            const isOpen = expanded.has(et.id);
            const subsDaEtapa = subs.filter((s) => s.etapa_id === et.id);
            const total = totalPorEtapa.get(et.id) ?? 0;
            return (
              <Card
                key={et.id}
                className={dragOverId === et.id ? "ring-2 ring-primary" : ""}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(et.id); }}
                onDragLeave={() => setDragOverId((cur) => (cur === et.id ? null : cur))}
                onDrop={() => onDropOn(et.id)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => { dragId.current = et.id; }}
                      onDragEnd={() => { dragId.current = null; setDragOverId(null); }}
                      className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:opacity-50"
                      aria-label="Arrastar para reordenar"
                      title="Arrastar para reordenar"
                      disabled={saving}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(et.id)}
                      className="rounded p-1 hover:bg-muted"
                      aria-label="Expandir etapa"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          <span className="mr-1 text-muted-foreground tabular-nums">
                            {String(etapas.findIndex((x) => x.id === et.id) + 1).padStart(2, "0")}.
                          </span>
                          {et.nome}
                        </p>
                        <Badge variant="secondary">{subsDaEtapa.length} itens</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Prev:{" "}
                          {et.dt_inicio_prevista
                            ? new Date(et.dt_inicio_prevista).toLocaleDateString("pt-BR")
                            : "—"}{" "}
                          →{" "}
                          {et.dt_fim_prevista
                            ? new Date(et.dt_fim_prevista).toLocaleDateString("pt-BR")
                            : "—"}
                        </span>
                        <span>
                          Real:{" "}
                          {et.dt_inicio_real
                            ? new Date(et.dt_inicio_real).toLocaleDateString("pt-BR")
                            : "—"}{" "}
                          →{" "}
                          {et.dt_fim_real
                            ? new Date(et.dt_fim_real).toLocaleDateString("pt-BR")
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="w-40">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{Number(et.percentual).toFixed(0)}%</span>
                      </div>
                      <Progress value={Number(et.percentual)} className="h-2" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">{fmtBRL(total)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirSubNova(et.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => abrirEtapaEdit(et)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Todas as subetapas vinculadas serão excluídas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => excluirEtapa(et.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t bg-muted/30 px-4 py-2">
                      {subsDaEtapa.length === 0 ? (
                        <div className="py-3 text-center text-xs text-muted-foreground">
                          Nenhuma subetapa. Use o "+" acima para adicionar.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {subsDaEtapa.map((s) => (
                            <div
                              key={s.id}
                              className="flex flex-wrap items-center gap-3 py-2"
                            >
                              <div className="flex-1 min-w-[180px] pl-8">
                                <p className="text-sm">{s.nome}</p>
                                {s.tipo && (
                                  <p className="text-xs text-muted-foreground">{s.tipo}</p>
                                )}
                              </div>
                              <div className="text-sm font-medium">
                                {fmtBRL(Number(s.valor_orcado))}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => abrirSubEdit(s)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir subetapa?</AlertDialogTitle>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => excluirSub(s.id)}>
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog Etapa */}
      <Dialog open={etapaDialog} onOpenChange={setEtapaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEtapa ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarEtapa} className="space-y-3">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                required
                value={eNome}
                onChange={(e) => setENome(e.target.value)}
                placeholder="Ex.: Fundação"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início previsto</Label>
                <Input type="date" value={eDtIniPrev} onChange={(e) => setEDtIniPrev(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim previsto</Label>
                <Input type="date" value={eDtFimPrev} onChange={(e) => setEDtFimPrev(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Início real</Label>
                <Input type="date" value={eDtIniReal} onChange={(e) => setEDtIniReal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim real</Label>
                <Input type="date" value={eDtFimReal} onChange={(e) => setEDtFimReal(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Percentual concluído (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={ePercentual}
                onChange={(e) => setEPercentual(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se "Fim real" for preenchido, o percentual vai automaticamente para 100%.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Subetapa */}
      <Dialog open={subDialog} onOpenChange={setSubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSub ? "Editar subetapa" : "Nova subetapa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarSub} className="space-y-3">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                required
                value={sNome}
                onChange={(e) => setSNome(e.target.value)}
                placeholder="Ex.: Concreto magro"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input
                value={sTipo}
                onChange={(e) => setSTipo(e.target.value)}
                placeholder="Ex.: Material, Mão de obra, Serviço"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor orçado (R$) *</Label>
              <Input
                required
                type="number"
                min={0}
                step="0.01"
                value={sValor}
                onChange={(e) => setSValor(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
