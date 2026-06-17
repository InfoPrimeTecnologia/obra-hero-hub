import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, Pencil, GripVertical, Loader2, Calendar as CalIcon, User, Package, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentCustomerId } from "@/lib/use-current-customer";
import { useObraSelecionada } from "@/lib/obra-context";

export const Route = createFileRoute("/app/tarefas")({ component: TarefasPage });

type Coluna = { id: string; nome: string; ordem: number; cor: string | null; is_done: boolean };
type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  coluna_id: string | null;
  obra_id: string | null;
  etapa_id: string | null;
  responsavel_colaborador_id: string | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  prazo: string | null;
  ordem: number;
  concluida_em: string | null;
};
type Material = { id: string; tarefa_id: string; produto_id: string; quantidade: number; observacao: string | null };

const PRIO_COLOR: Record<Tarefa["prioridade"], string> = {
  baixa: "bg-slate-200 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-amber-100 text-amber-800",
  urgente: "bg-red-100 text-red-700",
};

function TarefasPage() {
  const qc = useQueryClient();
  const { customerId } = useCurrentCustomerId();
  const { obra } = useObraSelecionada();
  const obraId = obra?.id ?? null;

  const [taskDialog, setTaskDialog] = useState<{ open: boolean; tarefa?: Tarefa | null; colunaId?: string }>({ open: false });
  const [colDialog, setColDialog] = useState(false);

  const colunasQ = useQuery({
    enabled: !!customerId,
    queryKey: ["tarefa_colunas", customerId, obraId],
    queryFn: async () => {
      let q = (supabase as any).from("tarefa_colunas").select("*").eq("customer_id", customerId).order("ordem");
      q = obraId ? q.or(`obra_id.eq.${obraId},obra_id.is.null`) : q.is("obra_id", null);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let cols = (data ?? []) as Coluna[];
      if (cols.length === 0) {
        // seed default 3 columns globais
        const seed = [
          { nome: "A fazer", ordem: 0, cor: "#94a3b8", is_done: false },
          { nome: "Em andamento", ordem: 1, cor: "#3b82f6", is_done: false },
          { nome: "Concluído", ordem: 2, cor: "#10b981", is_done: true },
        ].map((c) => ({ ...c, customer_id: customerId, obra_id: null }));
        const { data: inserted } = await (supabase as any).from("tarefa_colunas").insert(seed).select("*");
        cols = (inserted ?? []) as Coluna[];
      }
      return cols;
    },
  });

  const tarefasQ = useQuery({
    enabled: !!customerId,
    queryKey: ["tarefas", customerId, obraId],
    queryFn: async () => {
      let q = (supabase as any).from("tarefas").select("*").eq("customer_id", customerId).order("ordem");
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Tarefa[];
    },
  });

  const colunas = useMemo(() => (colunasQ.data ?? []).slice().sort((a, b) => a.ordem - b.ordem), [colunasQ.data]);
  const tarefasPorColuna = useMemo(() => {
    const m: Record<string, Tarefa[]> = {};
    for (const c of colunas) m[c.id] = [];
    for (const t of tarefasQ.data ?? []) {
      const colId = t.coluna_id ?? colunas[0]?.id;
      if (colId && m[colId]) m[colId].push(t);
    }
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.ordem - b.ordem));
    return m;
  }, [tarefasQ.data, colunas]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const onDragEnd = async (e: DragEndEvent) => {
    const tid = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const tarefa = (tarefasQ.data ?? []).find((t) => t.id === tid);
    if (!tarefa) return;
    // overId pode ser id de coluna (droppable) ou id de tarefa (sortable)
    let destColId = overId;
    const overTarefa = (tarefasQ.data ?? []).find((t) => t.id === overId);
    if (overTarefa?.coluna_id) destColId = overTarefa.coluna_id;
    if (destColId === tarefa.coluna_id && overId === tid) return;

    const destCol = colunas.find((c) => c.id === destColId);
    const patch: any = { coluna_id: destColId };
    if (destCol?.is_done && !tarefa.concluida_em) patch.concluida_em = new Date().toISOString();
    if (!destCol?.is_done) patch.concluida_em = null;

    await (supabase as any).from("tarefas").update(patch).eq("id", tid);
    qc.invalidateQueries({ queryKey: ["tarefas", customerId, obraId] });
  };

  if (!customerId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Quadro Kanban {obra ? `· ${obra.name}` : "(geral)"} · arraste cartões entre colunas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setColDialog(true)}>
            Gerenciar colunas
          </Button>
          <Button onClick={() => setTaskDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" /> Nova tarefa
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
          {colunas.map((c) => (
            <Column
              key={c.id}
              coluna={c}
              tarefas={tarefasPorColuna[c.id] ?? []}
              onAdd={() => setTaskDialog({ open: true, colunaId: c.id })}
              onEdit={(t) => setTaskDialog({ open: true, tarefa: t })}
            />
          ))}
        </div>
      </DndContext>

      {taskDialog.open && customerId && (
        <TarefaDialog
          customerId={customerId}
          obraId={obraId}
          colunas={colunas}
          tarefa={taskDialog.tarefa ?? null}
          colunaIdInicial={taskDialog.colunaId ?? colunas[0]?.id ?? null}
          onClose={() => {
            setTaskDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["tarefas", customerId, obraId] });
          }}
        />
      )}
      {colDialog && (
        <ColunasDialog
          customerId={customerId}
          obraId={obraId}
          colunas={colunas}
          onClose={() => {
            setColDialog(false);
            qc.invalidateQueries({ queryKey: ["tarefa_colunas", customerId, obraId] });
          }}
        />
      )}
    </div>
  );
}

function Column({
  coluna,
  tarefas,
  onAdd,
  onEdit,
}: {
  coluna: Coluna;
  tarefas: Tarefa[];
  onAdd: () => void;
  onEdit: (t: Tarefa) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <div className="flex w-80 shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: coluna.cor ?? "#94a3b8" }} />
          <span className="text-sm font-semibold">{coluna.nome}</span>
          <Badge variant="secondary" className="ml-1">
            {tarefas.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 transition-colors ${isOver ? "bg-primary/5" : ""}`}
        style={{ minHeight: 120 }}
      >
        <SortableContext items={tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tarefas.map((t) => (
            <TarefaCard key={t.id} tarefa={t} onEdit={() => onEdit(t)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function TarefaCard({ tarefa, onEdit }: { tarefa: Tarefa; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarefa.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none" as const,
  };
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab hover:shadow-md active:cursor-grabbing"
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onEdit}
          >
            <div className="line-clamp-2 text-sm font-medium">{tarefa.titulo}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${PRIO_COLOR[tarefa.prioridade]}`}>{tarefa.prioridade}</span>
              {tarefa.prazo && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalIcon className="h-3 w-3" /> {new Date(tarefa.prazo).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Dialog: gerenciar colunas ---------- */
function ColunasDialog({
  customerId,
  obraId,
  colunas,
  onClose,
}: {
  customerId: string;
  obraId: string | null;
  colunas: Coluna[];
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Coluna[]>(colunas);
  const [novo, setNovo] = useState({ nome: "", cor: "#94a3b8", is_done: false });

  useEffect(() => setLocal(colunas), [colunas]);

  const add = async () => {
    if (!novo.nome.trim()) return;
    const ordem = Math.max(-1, ...local.map((c) => c.ordem)) + 1;
    const { data, error } = await (supabase as any)
      .from("tarefa_colunas")
      .insert({ customer_id: customerId, obra_id: obraId, ...novo, ordem })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setLocal((arr) => [...arr, data as Coluna]);
    setNovo({ nome: "", cor: "#94a3b8", is_done: false });
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("tarefa_colunas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLocal((arr) => arr.filter((c) => c.id !== id));
  };

  const rename = async (id: string, nome: string) => {
    setLocal((arr) => arr.map((c) => (c.id === id ? { ...c, nome } : c)));
    await (supabase as any).from("tarefa_colunas").update({ nome }).eq("id", id);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Colunas do Kanban</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {local.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded border p-2">
              <input
                type="color"
                value={c.cor ?? "#94a3b8"}
                onChange={async (e) => {
                  const cor = e.target.value;
                  setLocal((arr) => arr.map((x) => (x.id === c.id ? { ...x, cor } : x)));
                  await (supabase as any).from("tarefa_colunas").update({ cor }).eq("id", c.id);
                }}
                className="h-8 w-8 cursor-pointer rounded border"
              />
              <Input value={c.nome} onChange={(e) => rename(c.id, e.target.value)} className="flex-1" />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={c.is_done}
                  onChange={async (e) => {
                    const v = e.target.checked;
                    setLocal((arr) => arr.map((x) => (x.id === c.id ? { ...x, is_done: v } : x)));
                    await (supabase as any).from("tarefa_colunas").update({ is_done: v }).eq("id", c.id);
                  }}
                />
                Concluído
              </label>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded border border-dashed p-2">
            <input
              type="color"
              value={novo.cor}
              onChange={(e) => setNovo({ ...novo, cor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border"
            />
            <Input
              placeholder="Nova coluna…"
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="flex-1"
            />
            <Button onClick={add}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Dialog: criar/editar tarefa ---------- */
function TarefaDialog({
  customerId,
  obraId,
  colunas,
  tarefa,
  colunaIdInicial,
  onClose,
}: {
  customerId: string;
  obraId: string | null;
  colunas: Coluna[];
  tarefa: Tarefa | null;
  colunaIdInicial: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    coluna_id: tarefa?.coluna_id ?? colunaIdInicial ?? "",
    etapa_id: tarefa?.etapa_id ?? "",
    responsavel_colaborador_id: tarefa?.responsavel_colaborador_id ?? "",
    prioridade: tarefa?.prioridade ?? "media",
    prazo: tarefa?.prazo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [novoMat, setNovoMat] = useState({ produto_id: "", quantidade: 1, observacao: "" });

  const colaboradoresQ = useQuery({
    queryKey: ["colaboradores", customerId],
    queryFn: async () => {
      const { data } = await supabase.from("colaboradores").select("id, nome").eq("customer_id", customerId).order("nome");
      return data ?? [];
    },
  });
  const etapasQ = useQuery({
    enabled: !!obraId,
    queryKey: ["etapas-obra", obraId],
    queryFn: async () => {
      const { data } = await supabase.from("orcamento_etapas").select("id, nome").eq("obra_id", obraId!).order("ordem");
      return data ?? [];
    },
  });
  const produtosQ = useQuery({
    queryKey: ["produtos-all", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, unidade")
        .eq("customer_id", customerId)
        .order("nome")
        .limit(500);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!tarefa) return;
    (async () => {
      const { data } = await (supabase as any).from("tarefa_materiais").select("*").eq("tarefa_id", tarefa.id);
      setMateriais((data ?? []) as Material[]);
    })();
  }, [tarefa]);

  const save = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    try {
      const destCol = colunas.find((c) => c.id === form.coluna_id);
      const payload: any = {
        customer_id: customerId,
        obra_id: obraId,
        coluna_id: form.coluna_id || null,
        titulo: form.titulo,
        descricao: form.descricao || null,
        etapa_id: form.etapa_id || null,
        responsavel_colaborador_id: form.responsavel_colaborador_id || null,
        prioridade: form.prioridade,
        prazo: form.prazo || null,
        concluida_em: destCol?.is_done ? new Date().toISOString() : null,
      };
      let tarefaId = tarefa?.id;
      if (tarefa) {
        const { error } = await (supabase as any).from("tarefas").update(payload).eq("id", tarefa.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await (supabase as any).from("tarefas").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        tarefaId = data.id;
      }
      // sincroniza materiais (delete os removidos, insere novos sem id)
      if (tarefaId) {
        const { data: existing } = await (supabase as any).from("tarefa_materiais").select("id").eq("tarefa_id", tarefaId);
        const existingIds = new Set<string>((existing ?? []).map((r: any) => String(r.id)));
        const keepIds = new Set<string>(materiais.filter((m) => m.id).map((m) => String(m.id)));
        const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
        if (toDelete.length) await (supabase as any).from("tarefa_materiais").delete().in("id", toDelete);
        const toInsert = materiais.filter((m) => !m.id);
        if (toInsert.length) {
          await (supabase as any).from("tarefa_materiais").insert(
            toInsert.map((m) => ({
              customer_id: customerId,
              tarefa_id: tarefaId,
              produto_id: m.produto_id,
              quantidade: m.quantidade,
              observacao: m.observacao,
            })),
          );
        }
      }
      toast.success(tarefa ? "Tarefa atualizada" : "Tarefa criada");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!tarefa) return;
    if (!confirm("Excluir tarefa?")) return;
    await (supabase as any).from("tarefas").delete().eq("id", tarefa.id);
    toast.success("Excluída");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Coluna</Label>
              <Select value={form.coluna_id} onValueChange={(v) => setForm({ ...form, coluna_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_colaborador_id || "none"}
                onValueChange={(v) => setForm({ ...form, responsavel_colaborador_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguém</SelectItem>
                  {(colaboradoresQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
            </div>
            {obraId && (
              <div className="col-span-2">
                <Label>Etapa do orçamento</Label>
                <Select
                  value={form.etapa_id || "none"}
                  onValueChange={(v) => setForm({ ...form, etapa_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {(etapasQ.data ?? []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Materiais */}
          <div className="rounded border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" /> Materiais de estoque
            </div>
            <div className="space-y-2">
              {materiais.map((m, i) => {
                const prod = (produtosQ.data ?? []).find((p: any) => p.id === m.produto_id);
                return (
                  <div key={m.id ?? `new-${i}`} className="flex items-center gap-2 rounded bg-muted/40 p-2 text-sm">
                    <span className="flex-1">{prod?.nome ?? "?"} {prod?.unidade ? `(${prod.unidade})` : ""}</span>
                    <Input
                      type="number"
                      className="w-24"
                      value={m.quantidade}
                      onChange={(e) =>
                        setMateriais((arr) => arr.map((x, j) => (j === i ? { ...x, quantidade: Number(e.target.value) } : x)))
                      }
                    />
                    <Button variant="ghost" size="icon" onClick={() => setMateriais((arr) => arr.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Produto</Label>
                  <Select value={novoMat.produto_id} onValueChange={(v) => setNovoMat({ ...novoMat, produto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(produtosQ.data ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    value={novoMat.quantidade}
                    onChange={(e) => setNovoMat({ ...novoMat, quantidade: Number(e.target.value) })}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!novoMat.produto_id) return;
                    setMateriais((arr) => [
                      ...arr,
                      { id: "", tarefa_id: "", produto_id: novoMat.produto_id, quantidade: novoMat.quantidade, observacao: novoMat.observacao || null },
                    ]);
                    setNovoMat({ produto_id: "", quantidade: 1, observacao: "" });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {tarefa && (
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
