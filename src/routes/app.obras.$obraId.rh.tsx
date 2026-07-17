import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Trash2, UserPlus } from "lucide-react";
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
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/rh")({
  component: RhObraPage,
});

type Vinculo = {
  id: string;
  colaborador_id: string;
  data_inicio: string | null;
  data_fim: string | null;
};
type Colab = { id: string; nome: string; cargo: string | null };

const VINCULOS = ["CLT", "PJ", "MEI", "Autonomo", "Estagiario", "Temporario", "Terceirizado"] as const;

const novoInicial = {
  nome: "",
  cpf: "",
  cargo: "",
  vinculo: "CLT",
  telefone: "",
  email: "",
  remuneracao: 0,
  data_entrada: new Date().toISOString().slice(0, 10),
};

function RhObraPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [open, setOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [savingNovo, setSavingNovo] = useState(false);
  const [form, setForm] = useState({
    colaborador_id: "",
    data_inicio: new Date().toISOString().slice(0, 10),
  });
  const [novoForm, setNovoForm] = useState(novoInicial);

  const carregar = async () => {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase
        .from("colaborador_obras")
        .select("id,colaborador_id,data_inicio,data_fim")
        .eq("obra_id", obraId),
      supabase.from("colaboradores").select("id,nome,cargo").eq("ativo", true).order("nome"),
    ]);
    setVinculos(((v as unknown) as Vinculo[]) ?? []);
    setColabs((c as Colab[]) ?? []);
  };

  useEffect(() => {
    void carregar();
  }, [obraId]);

  const getCustomerId = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    return data?.id ?? null;
  };

  const vincular = async () => {
    if (!form.colaborador_id) return toast.error("Selecione um colaborador");
    const cid = await getCustomerId();
    if (!cid) return toast.error("Conta não identificada");
    const { error } = await supabase.from("colaborador_obras").insert({
      customer_id: cid,
      obra_id: obraId,
      colaborador_id: form.colaborador_id,
      data_inicio: form.data_inicio || null,
    });
    if (error) return toast.error("Erro ao vincular", { description: error.message });
    toast.success("Colaborador vinculado");
    setOpen(false);
    setForm({ colaborador_id: "", data_inicio: new Date().toISOString().slice(0, 10) });
    void carregar();
  };

  const criarEVincular = async () => {
    if (!novoForm.nome.trim()) return toast.error("Informe o nome");
    setSavingNovo(true);
    try {
      const cid = await getCustomerId();
      if (!cid) throw new Error("Conta não identificada");
      const { data: novoColab, error: e1 } = await supabase
        .from("colaboradores")
        .insert({
          customer_id: cid,
          nome: novoForm.nome.trim(),
          cpf: novoForm.cpf || null,
          cargo: novoForm.cargo || null,
          vinculo: novoForm.vinculo,
          telefone: novoForm.telefone || null,
          email: novoForm.email || null,
          remuneracao: Number(novoForm.remuneracao) || 0,
          data_entrada: novoForm.data_entrada || null,
          ativo: true,
        })
        .select("id")
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("colaborador_obras").insert({
        customer_id: cid,
        obra_id: obraId,
        colaborador_id: novoColab!.id,
        data_inicio: novoForm.data_entrada || null,
      });
      if (e2) throw e2;
      toast.success("Colaborador cadastrado e vinculado");
      setNovoOpen(false);
      setNovoForm(novoInicial);
      void carregar();
    } catch (err: any) {
      toast.error("Erro ao cadastrar", { description: err.message });
    } finally {
      setSavingNovo(false);
    }
  };

  const desvincular = async (id: string) => {
    if (!confirm("Remover vínculo?")) return;
    const { error } = await supabase.from("colaborador_obras").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Vínculo removido");
    void carregar();
  };

  const colab = (cid: string) => colabs.find((c) => c.id === cid);

  return (
    <div>
      <PageHeader
        title="RH da obra"
        description="Colaboradores vinculados a esta obra"
        actions={
          <div className="flex gap-2">
            <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" /> Novo colaborador
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Cadastrar colaborador nesta obra</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={novoForm.nome}
                      onChange={(e) => setNovoForm((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input
                      value={novoForm.cpf}
                      onChange={(e) => setNovoForm((p) => ({ ...p, cpf: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input
                      value={novoForm.cargo}
                      onChange={(e) => setNovoForm((p) => ({ ...p, cargo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vínculo</Label>
                    <Select
                      value={novoForm.vinculo}
                      onValueChange={(v) => setNovoForm((p) => ({ ...p, vinculo: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VINCULOS.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remuneração</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={novoForm.remuneracao}
                      onChange={(e) =>
                        setNovoForm((p) => ({ ...p, remuneracao: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={novoForm.telefone}
                      onChange={(e) => setNovoForm((p) => ({ ...p, telefone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={novoForm.email}
                      onChange={(e) => setNovoForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Data de entrada</Label>
                    <Input
                      type="date"
                      value={novoForm.data_entrada}
                      onChange={(e) =>
                        setNovoForm((p) => ({ ...p, data_entrada: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={criarEVincular} disabled={savingNovo}>
                    {savingNovo ? "Salvando..." : "Cadastrar e vincular"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Vincular existente
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
          </div>
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
          vinculos.map((v) => {
            const c = colab(v.colaborador_id);
            return (
              <Card key={v.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{c?.nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {c?.cargo ? `${c.cargo}` : "Sem cargo"}
                      {v.data_inicio
                        ? ` • desde ${new Date(v.data_inicio).toLocaleDateString("pt-BR")}`
                        : ""}
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
            );
          })
        )}
      </div>
    </div>
  );
}
