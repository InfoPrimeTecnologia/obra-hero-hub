import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListPackages,
  adminUpsertPackage,
  adminDeletePackage,
  adminListActionCosts,
  adminUpdateActionCost,
  adminSearchCustomers,
  adminAdjustCredits,
} from "@/lib/credits.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Coins, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/creditos")({ component: AdminCreditosPage });

function AdminCreditosPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Créditos"
        description="Gerencie pacotes de recarga, custos por ação e ajustes manuais."
      />
      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages">Pacotes</TabsTrigger>
          <TabsTrigger value="costs">Custos por ação</TabsTrigger>
          <TabsTrigger value="adjust">Ajuste manual</TabsTrigger>
        </TabsList>
        <TabsContent value="packages" className="mt-4">
          <PackagesTab />
        </TabsContent>
        <TabsContent value="costs" className="mt-4">
          <CostsTab />
        </TabsContent>
        <TabsContent value="adjust" className="mt-4">
          <AdjustTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --------------- Packages ---------------
function PackagesTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListPackages);
  const upsert = useServerFn(adminUpsertPackage);
  const del = useServerFn(adminDeletePackage);
  const q = useQuery({ queryKey: ["admin-packages"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-packages"] });
      setEditing(null);
      toast.success("Pacote salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-packages"] });
      toast.success("Pacote removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pacotes de recarga</CardTitle>
        <Button
          onClick={() =>
            setEditing({ nome: "", valor_brl: 0, creditos: 0, destaque: false, ativo: true, ordem: 0 })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Novo pacote
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Valor (R$)</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">R$ / crédito</TableHead>
              <TableHead>Destaque</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.ordem}</TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-right font-mono">
                  {Number(p.valor_brl).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono">{p.creditos}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {(Number(p.valor_brl) / p.creditos).toFixed(4)}
                </TableCell>
                <TableCell>{p.destaque ? "Sim" : "—"}</TableCell>
                <TableCell>{p.ativo ? "Sim" : "Não"}</TableCell>
                <TableCell className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Remover este pacote?")) delMut.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} pacote</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.valor_brl}
                    onChange={(e) =>
                      setEditing({ ...editing, valor_brl: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Créditos</Label>
                  <Input
                    type="number"
                    value={editing.creditos}
                    onChange={(e) => setEditing({ ...editing, creditos: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editing.ordem}
                    onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.destaque}
                  onCheckedChange={(v) => setEditing({ ...editing, destaque: v })}
                />
                <Label>Destacar como "mais vendido"</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.ativo}
                  onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => upsertMut.mutate(editing)}
              disabled={upsertMut.isPending}
            >
              {upsertMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --------------- Costs ---------------
function CostsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListActionCosts);
  const update = useServerFn(adminUpdateActionCost);
  const q = useQuery({ queryKey: ["admin-costs"], queryFn: () => list() });

  const updateMut = useMutation({
    mutationFn: (payload: any) => update({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-costs"] });
      toast.success("Custo atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custo em créditos por ação</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-32">Custo</TableHead>
              <TableHead className="w-24">Ativo</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((c: any) => (
              <CostRow key={c.id} c={c} onSave={(p) => updateMut.mutate(p)} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CostRow({ c, onSave }: { c: any; onSave: (p: any) => void }) {
  const [custo, setCusto] = useState<number>(c.custo);
  const [ativo, setAtivo] = useState<boolean>(c.ativo);
  const dirty = custo !== c.custo || ativo !== c.ativo;
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{c.action_key}</TableCell>
      <TableCell>{c.descricao}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          value={custo}
          onChange={(e) => setCusto(Number(e.target.value))}
          className="w-24"
        />
      </TableCell>
      <TableCell>
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          disabled={!dirty}
          onClick={() => onSave({ id: c.id, custo, ativo })}
        >
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

// --------------- Adjust ---------------
function AdjustTab() {
  const search = useServerFn(adminSearchCustomers);
  const adjust = useServerFn(adminAdjustCredits);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [delta, setDelta] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  async function doSearch() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await search({ data: { q } });
      setResults(r);
    } finally {
      setLoading(false);
    }
  }

  async function doAdjust() {
    if (!selected || !delta || !motivo.trim()) {
      toast.error("Selecione empresa, defina delta e motivo");
      return;
    }
    try {
      const r: any = await adjust({
        data: { customerId: selected.id, delta, motivo },
      });
      toast.success(`Saldo atualizado: ${r.saldo} créditos`);
      setDelta(0);
      setMotivo("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajuste manual de créditos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nome, razão social ou email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <Button onClick={doSearch} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Buscar
          </Button>
        </div>

        {results.length > 0 && (
          <div className="rounded-md border">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${selected?.id === r.id ? "bg-accent" : ""}`}
              >
                <div className="font-medium">{r.company_name || r.name}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">
              Empresa selecionada: <strong>{selected.company_name || selected.name}</strong>
            </p>
            <div>
              <Label>Delta (use negativo para subtrair)</Label>
              <Input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Motivo (obrigatório, fica no extrato)</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={doAdjust}>Aplicar ajuste</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
