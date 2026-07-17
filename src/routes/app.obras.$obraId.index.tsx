import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  HardHat,
  ListTree,
  ClipboardList,
  ShoppingCart,
  Receipt,
  Users,
  TrendingUp,
  TrendingDown,
  Building2,
  MapPin,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PortalClienteCard } from "@/components/app/PortalClienteCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/")({
  component: ObraDashboard,
});

type ObraDet = {
  id: string;
  name: string;
  description: string | null;
  address_city: string | null;
  address_state: string | null;
  status: string;
  foto_url: string | null;
  empresa_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
};

function ObraDashboard() {
  const { obraId } = Route.useParams();
  const [obra, setObra] = useState<ObraDet | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [resumo, setResumo] = useState({
    orcado: 0,
    realizado: 0,
    aPagar: 0,
    compras: 0,
    rdos: 0,
    equipe: 0,
  });

  const [contatoOpen, setContatoOpen] = useState(false);
  const [contatoForm, setContatoForm] = useState({ contact_name: "", contact_email: "", contact_whatsapp: "" });
  const [savingContato, setSavingContato] = useState(false);

  const carregar = async () => {
    const { data: o, error } = await supabase
      .from("obras")
      .select("id,name,description,address_city,address_state,status,foto_url,empresa_id,contact_name,contact_email,contact_whatsapp")
      .eq("id", obraId)
      .maybeSingle();
    if (error) {
      toast.error("Erro ao carregar obra", { description: error.message });
      return;
    }
    setObra(o as ObraDet);
    if (o?.empresa_id) {
      const { data: emp } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", o.empresa_id)
        .maybeSingle();
      setEmpresaNome(emp?.nome ?? null);
    }
  };

  useEffect(() => {
    void (async () => {
      await carregar();

      const { data: etapasData } = await supabase
        .from("orcamento_etapas")
        .select("id")
        .eq("obra_id", obraId);
      const etapaIds = (etapasData ?? []).map((e: any) => e.id);
      const [subs, compras, cps, rdos, equipe] = await Promise.all([
        etapaIds.length
          ? supabase
              .from("orcamento_subetapas")
              .select("valor_orcado")
              .in("etapa_id", etapaIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("compras").select("valor_total").eq("obra_id", obraId),
        supabase
          .from("contas_pagar")
          .select("valor")
          .eq("obra_id", obraId)
          .eq("status", "pendente"),
        supabase.from("rdos").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabase
          .from("colaborador_obras")
          .select("id", { count: "exact", head: true })
          .eq("obra_id", obraId),
      ]);


      const orcado = (subs.data ?? []).reduce((s: number, r: any) => s + Number(r.valor_orcado || 0), 0);
      const realizado = (compras.data ?? []).reduce((s: number, r: any) => s + Number(r.valor_total || 0), 0);
      const aPagar = (cps.data ?? []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
      setResumo({
        orcado,
        realizado,
        aPagar,
        compras: (compras.data ?? []).length,
        rdos: rdos.count ?? 0,
        equipe: equipe.count ?? 0,
      });
    })();
  }, [obraId]);

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title={obra?.name ?? "Carregando..."}
        description={obra?.description ?? "Visão geral da obra"}
      />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
              {obra?.foto_url ? (
                <img src={obra.foto_url} className="h-full w-full object-cover" alt={obra.name} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <HardHat className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <div className="text-sm text-muted-foreground">
                {empresaNome ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {empresaNome}
                  </span>
                ) : null}
                {(obra?.address_city || obra?.address_state) && (
                  <span className="ml-3 inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[obra?.address_city, obra?.address_state].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Status: {obra?.status ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                Contato: {obra?.contact_name ?? "—"}
                {obra?.contact_whatsapp ? ` · WhatsApp ${obra.contact_whatsapp}` : ""}
                {obra?.contact_email ? ` · ${obra.contact_email}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContatoForm({
                  contact_name: obra?.contact_name ?? "",
                  contact_email: obra?.contact_email ?? "",
                  contact_whatsapp: obra?.contact_whatsapp ?? "",
                });
                setContatoOpen(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Editar contato
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <KCard
            icon={<ListTree className="h-4 w-4 text-primary" />}
            label="Orçado"
            value={brl(resumo.orcado)}
            to={`/app/obras/${obraId}/orcamento`}
          />
          <KCard
            icon={<TrendingDown className="h-4 w-4 text-destructive" />}
            label="Realizado (compras)"
            value={brl(resumo.realizado)}
            to={`/app/obras/${obraId}/compras`}
          />
          <KCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            label="Saldo orçamento"
            value={brl(resumo.orcado - resumo.realizado)}
          />
          <KCard
            icon={<Receipt className="h-4 w-4 text-accent" />}
            label="A pagar (pendente)"
            value={brl(resumo.aPagar)}
            to={`/app/obras/${obraId}/contas-pagar`}
          />
          <KCard
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Compras"
            value={String(resumo.compras)}
            to={`/app/obras/${obraId}/compras`}
          />
          <KCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="RDOs"
            value={String(resumo.rdos)}
            to={`/app/obras/${obraId}/rdo`}
          />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <p className="mr-3 text-sm font-medium">Atalhos:</p>
            <ShortcutBtn to={`/app/obras/${obraId}/rdo`} icon={<ClipboardList className="h-4 w-4" />} label="Novo RDO" />
            <ShortcutBtn
              to={`/app/obras/${obraId}/compras`}
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Nova compra"
            />
            <ShortcutBtn
              to={`/app/obras/${obraId}/contas-pagar`}
              icon={<Receipt className="h-4 w-4" />}
              label="Conta a pagar"
            />
            <ShortcutBtn
              to={`/app/obras/${obraId}/rh`}
              icon={<Users className="h-4 w-4" />}
              label={`Equipe (${resumo.equipe})`}
            />
          </CardContent>
        </Card>

        <PortalClienteCard obraId={obraId} />
      </div>

      <Dialog open={contatoOpen} onOpenChange={setContatoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar contato da obra</DialogTitle></DialogHeader>
          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              setSavingContato(true);
              const { error } = await supabase.from("obras").update({
                contact_name: contatoForm.contact_name || null,
                contact_email: contatoForm.contact_email || null,
                contact_whatsapp: contatoForm.contact_whatsapp || null,
              }).eq("id", obraId);
              setSavingContato(false);
              if (error) return toast.error("Erro", { description: error.message });
              toast.success("Contato atualizado");
              setContatoOpen(false);
              void carregar();
            }}
            className="space-y-3"
          >
            <div className="space-y-2"><Label>Nome do contato</Label>
              <Input value={contatoForm.contact_name} onChange={(e) => setContatoForm({ ...contatoForm, contact_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>WhatsApp (com DDD)</Label>
              <Input placeholder="(11) 99999-9999" value={contatoForm.contact_whatsapp} onChange={(e) => setContatoForm({ ...contatoForm, contact_whatsapp: e.target.value })} />
              <p className="text-xs text-muted-foreground">Usado para envio de RDO e relatórios pelo WhatsApp.</p>
            </div>
            <div className="space-y-2"><Label>E-mail</Label>
              <Input type="email" value={contatoForm.contact_email} onChange={(e) => setContatoForm({ ...contatoForm, contact_email: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContatoOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingContato}>{savingContato ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KCard({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  to?: string;
}) {
  const inner = (
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </CardContent>
  );
  if (to) {
    return (
      <Link to={to} className="block">
        <Card className="transition-shadow hover:shadow-md">{inner}</Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

function ShortcutBtn({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={to}>
        {icon}
        <span className="ml-2">{label}</span>
      </Link>
    </Button>
  );
}
