import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Plus, FileText, MessageCircle, Copy } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/obras/$obraId/rdo")({
  component: RdoListPage,
});

type Obra = { id: string; customer_id: string; name: string };
type Rdo = {
  id: string;
  data: string;
  condicao: string;
  responsavel: string | null;
  observacoes: string | null;
};

function RdoListPage() {
  const { obraId } = Route.useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [obra, setObra] = useState<Obra | null>(null);
  const [rdos, setRdos] = useState<Rdo[]>([]);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [responsavel, setResponsavel] = useState("");
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    const { data: o } = await supabase
      .from("obras")
      .select("id,customer_id,name")
      .eq("id", obraId)
      .maybeSingle();
    setObra(o as Obra | null);

    const { data: rs } = await supabase
      .from("rdos")
      .select("id,data,condicao,responsavel,observacoes")
      .eq("obra_id", obraId)
      .order("data", { ascending: false })
      .limit(60);
    setRdos((rs ?? []) as Rdo[]);
  };

  useEffect(() => {
    void carregar();
  }, [obraId]);

  const criar = async () => {
    if (!obra) return;
    setSaving(true);
    const { data: created, error } = await supabase
      .from("rdos")
      .insert({
        obra_id: obra.id,
        customer_id: obra.customer_id,
        data,
        responsavel: responsavel || null,
        created_by: user!.id,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar RDO", { description: error.message });
      return;
    }
    toast.success("RDO criado");
    setOpen(false);
    setResponsavel("");
    if (created) {
      navigate({ to: "/app/obras/$obraId/rdo/$rdoId", params: { obraId, rdoId: created.id } });
    }
  };

  const duplicar = async (origem: Rdo) => {
    if (!obra) return;
    const novaData = window.prompt(
      "Data do novo RDO (AAAA-MM-DD):",
      new Date().toISOString().slice(0, 10),
    );
    if (!novaData) return;
    const { data: criado, error } = await supabase
      .from("rdos")
      .insert({
        obra_id: obra.id,
        customer_id: obra.customer_id,
        data: novaData,
        condicao: origem.condicao,
        responsavel: origem.responsavel,
        observacoes: origem.observacoes,
        created_by: user!.id,
      })
      .select("id")
      .maybeSingle();
    if (error || !criado) {
      toast.error("Erro ao duplicar RDO", { description: error?.message });
      return;
    }
    // copia equipes, atividades e ocorrências (sem anexos)
    const [{ data: eq }, { data: at }, { data: oc }] = await Promise.all([
      supabase.from("rdo_equipes").select("empreiteiro,funcao,quantidade,horas").eq("rdo_id", origem.id),
      supabase
        .from("rdo_atividades")
        .select("etapa_id,subetapa_id,descricao,percentual")
        .eq("rdo_id", origem.id),
      supabase.from("rdo_ocorrencias").select("tipo,descricao").eq("rdo_id", origem.id),
    ]);
    if (eq?.length) {
      await supabase
        .from("rdo_equipes")
        .insert(eq.map((r) => ({ ...r, rdo_id: criado.id, customer_id: obra.customer_id })));
    }
    if (at?.length) {
      await supabase
        .from("rdo_atividades")
        .insert(at.map((r) => ({ ...r, rdo_id: criado.id, customer_id: obra.customer_id })));
    }
    if (oc?.length) {
      await supabase
        .from("rdo_ocorrencias")
        .insert(oc.map((r) => ({ ...r, rdo_id: criado.id, customer_id: obra.customer_id })));
    }
    toast.success("RDO duplicado");
    navigate({ to: "/app/obras/$obraId/rdo/$rdoId", params: { obraId, rdoId: criado.id } });
  };

  const listPath = `/app/obras/${obraId}/rdo`;
  if (location.pathname.replace(/\/$/, "") !== listPath) {
    return <Outlet />;
  }

  return (
    <div>
      <PageHeader
        title={obra ? `RDO — ${obra.name}` : "RDO"}
        description="Relatório Diário de Obra"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/obras">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo RDO
            </Button>
          </div>
        }
      />
      <div className="space-y-3 p-8">
        {rdos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 h-8 w-8" />
              Nenhum RDO ainda. Crie o primeiro.
            </CardContent>
          </Card>
        ) : (
          rdos.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {r.responsavel ?? "—"} • {r.condicao}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => navigate({ to: "/app/obras/$obraId/rdo/$rdoId", params: { obraId, rdoId: r.id } })}
                  >
                    <FileText className="mr-2 h-4 w-4" /> Abrir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    title="Abrir RDO para enviar via WhatsApp"
                    onClick={() => navigate({ to: "/app/obras/$obraId/rdo/$rdoId", params: { obraId, rdoId: r.id } })}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo RDO</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do responsável pelo relatório"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={saving}>
              {saving ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
