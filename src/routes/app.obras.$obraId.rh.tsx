import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/rh")({
  component: RhObraPage,
});

type Vinculo = {
  id: string;
  colaborador_id: string;
  funcao_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
};
type Colab = { id: string; nome: string; cargo: string | null };
type Funcao = { id: string; nome: string };

function RhObraPage() {
  const { obraId } = Route.useParams();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    colaborador_id: "",
    funcao_id: "",
    data_inicio: new Date().toISOString().slice(0, 10),
  });

  const carregar = async () => {
    const [{ data: v }, { data: c }, { data: f }] = await Promise.all([
      supabase
        .from("colaborador_obras")
        .select("id,colaborador_id,funcao_id,data_inicio,data_fim")
        .eq("obra_id", obraId),
      supabase.from("colaboradores").select("id,nome,cargo").eq("ativo", true).order("nome"),
      supabase.from("funcoes_equipe_obra").select("id,nome").order("nome"),
    ]);
    setVinculos((v ?? []) as Vinculo[]);
    setColabs((c ?? []) as Colab[]);
    setFuncoes((f ?? []) as Funcao[]);
  };

  useEffect(() => {
    void carregar();
  }, [obraId]);

  const vincular = async () => {
    if (!form.colaborador_id) return toast.error("Selecione um colaborador");
    const { error } = await supabase.from("colaborador_obras").insert({
      obra_id: obraId,
      colaborador_id: form.colaborador_id,
      funcao_id: form.funcao_id || null,
      data_inicio: form.data_inicio || null,
    });
    if (error) return toast.error("Erro ao vincular", { description: error.message });
    toast.success("Colaborador vinculado");
    setOpen(false);
    setForm({ colaborador_id: "", funcao_id: "", data_inicio: new Date().toISOString().slice(0, 10) });
    void carregar();
  };

  const desvincular = async (id: string) => {
    if (!confirm("Remover vínculo?")) return;
    const { error } = await supabase.from("colaborador_obras").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Vínculo removido");
    void carregar();
  };

  const nome = (cid: string) => colabs.find((c) => c.id === cid)?.nome ?? "—";
  const fnome = (fid: string | null) => (fid ? funcoes.find((f) => f.id === fid)?.nome ?? "—" : "—");

  return (
    <div>
      <PageHeader
        title="RH da obra"
        description="Colaboradores vinculados a esta obra"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Vincular colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vincular colaborador</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Colaborador *</Label>
                  <Select
                    value={form.colaborador_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, colaborador_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {colabs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                          {c.cargo ? ` — ${c.cargo}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Função na obra</Label>
                  <Select
                    value={form.funcao_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, funcao_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcoes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de início</Label>
                  <Input
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={vincular}>Vincular</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        {vinculos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Nenhum colaborador vinculado a esta obra.
            </CardContent>
          </Card>
        ) : (
          vinculos.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{nome(v.colaborador_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    Função: {fnome(v.funcao_id)}
                    {v.data_inicio ? ` • desde ${new Date(v.data_inicio).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {v.data_fim ? <Badge variant="outline">Desligado</Badge> : <Badge>Ativo</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => desvincular(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
