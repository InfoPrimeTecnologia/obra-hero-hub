import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, FolderOpen, CheckCircle2, ListTree, Building2, Camera, Loader2, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useObraSelecionada, type Obra } from "@/lib/obra-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/")({
  component: ObrasPage,
});

type Empresa = { id: string; nome: string };

function ObrasPage() {
  const { user } = useAuth();
  const { obra: obraAtiva, setObra } = useObraSelecionada();
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [name, setName] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);

  const carregar = async () => {
    const [{ data: obrasData, error: obrasErr }, { data: empresasData }] = await Promise.all([
      supabase
        .from("obras")
        .select(
          "id,name,customer_id,empresa_id,contact_name,contact_email,contact_whatsapp,address_city,address_state,status,foto_url",
        )
        .order("created_at", { ascending: false }),
      supabase.from("empresas").select("id,nome").order("nome"),
    ]);
    if (obrasErr) {
      toast.error("Erro ao carregar obras", { description: obrasErr.message });
      return;
    }
    setObras((obrasData ?? []) as Obra[]);
    setEmpresas((empresasData ?? []) as Empresa[]);
  };

  const uploadFoto = async (obraId: string, file: File) => {
    setUploadingFoto(obraId);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${obraId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("obra-fotos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("obra-fotos").getPublicUrl(path);
      const { error: updErr } = await supabase.from("obras").update({ foto_url: pub.publicUrl }).eq("id", obraId);
      if (updErr) throw updErr;
      toast.success("Foto atualizada");
      void carregar();
    } catch (e: any) {
      toast.error("Erro ao enviar foto", { description: e?.message });
    } finally {
      setUploadingFoto(null);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const resetForm = () => {
    setName("");
    setEmpresaId("");
    setDescription("");
    setContactName("");
    setContactEmail("");
    setContactWhatsapp("");
    setCity("");
    setState("");
  };

  const cadastrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      toast.error("Selecione uma empresa.");
      return;
    }
    setSaving(true);
    const { data: customer, error: cErr } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    if (cErr || !customer) {
      setSaving(false);
      toast.error("Não foi possível identificar sua conta.");
      return;
    }
    const { error } = await supabase.from("obras").insert({
      customer_id: customer.id,
      empresa_id: empresaId,
      name,
      description: description || null,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      contact_whatsapp: contactWhatsapp || null,
      address_city: city || null,
      address_state: state || null,
      created_by: user!.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao cadastrar obra", { description: error.message });
      return;
    }
    toast.success("Obra cadastrada!");
    resetForm();
    setOpen(false);
    void carregar();
  };

  const abrirObra = (o: Obra) => {
    setObra(o);
    toast.success(`Obra ativa: ${o.name}`);
    navigate({ to: "/app/obras/$obraId/rdo", params: { obraId: o.id } });
  };

  const obrasFiltradas =
    filtroEmpresa === "todas"
      ? obras
      : obras.filter((o) => o.empresa_id === filtroEmpresa);

  const empresaNome = (id: string | null) =>
    empresas.find((e) => e.id === id)?.nome ?? "—";

  return (
    <div>
      <PageHeader
        title="Obras"
        description="Cadastre, abra e gerencie suas obras"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={empresas.length === 0}>
                <Plus className="mr-2 h-4 w-4" /> Nova obra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar obra</DialogTitle>
              </DialogHeader>
              <form onSubmit={cadastrar} className="space-y-3">
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome da obra *</Label>
                  <Input required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Responsável da obra</Label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nome para envio do diário"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>E-mail do contato</Label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp do contato</Label>
                    <Input
                      value={contactWhatsapp}
                      onChange={(e) => setContactWhatsapp(e.target.value)}
                      placeholder="55119..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        {empresas.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-primary" />
                Cadastre uma empresa antes de criar sua primeira obra.
              </div>
              <Button asChild size="sm">
                <Link to="/app/empresas">Ir para Empresas</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {empresas.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Filtrar por empresa:</Label>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {obrasFiltradas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {empresas.length === 0
                ? 'Nenhuma obra ainda.'
                : 'Nenhuma obra para este filtro. Clique em "Nova obra" para começar.'}
            </CardContent>
          </Card>
        ) : (
          obrasFiltradas.map((o) => {
            const ativa = obraAtiva?.id === o.id;
            return (
              <Card key={o.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <ObraThumb
                    obra={o}
                    uploading={uploadingFoto === o.id}
                    onPick={(file) => uploadFoto(o.id, file)}
                  />
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{o.name}</p>
                      {ativa && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Building2 className="mr-1 inline h-3 w-3" />
                      {empresaNome(o.empresa_id)}
                      {" • "}
                      {[o.address_city, o.address_state].filter(Boolean).join(" / ") ||
                        "Sem endereço"}
                      {o.contact_name ? ` • Resp.: ${o.contact_name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={ativa ? "default" : "outline"}
                      size="sm"
                      onClick={() => abrirObra(o)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      {ativa ? "Aberta" : "Abrir"}
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/app/obras/$obraId/orcamento" params={{ obraId: o.id }}>
                        <ListTree className="mr-2 h-4 w-4" /> Orçamento
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/app/obras/$obraId/rdo" params={{ obraId: o.id }}>
                        RDO
                      </Link>
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
