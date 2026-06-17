import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, FolderOpen, CheckCircle2, ListTree, Building2, Camera, Loader2, ImageIcon, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

function ObraThumb({
  obra,
  uploading,
  onPick,
}: {
  obra: Obra;
  uploading: boolean;
  onPick: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-muted text-muted-foreground transition hover:opacity-90"
      title="Trocar foto da obra"
    >
      {obra.foto_url ? (
        <img src={obra.foto_url} alt={obra.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-0.5 text-[10px] text-white">
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
        {uploading ? "..." : obra.foto_url ? "Trocar" : "Adicionar"}
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ObrasPage() {
  const { user } = useAuth();
  const { obra: obraAtiva, setObra } = useObraSelecionada();
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<"ativas" | "arquivadas" | "todas">("ativas");
  const [obraParaExcluir, setObraParaExcluir] = useState<Obra | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [excluindo, setExcluindo] = useState(false);
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
      const obra = obras.find((o) => o.id === obraId);
      const customer_id = obra?.customer_id;
      if (!customer_id) throw new Error("Conta não identificada");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${customer_id}/${obraId}/${Date.now()}.${ext}`;
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

  const arquivarObra = async (o: Obra, arquivar: boolean) => {
    const novoStatus = arquivar ? "arquivada" : "ativa";
    const { error } = await supabase.from("obras").update({ status: novoStatus }).eq("id", o.id);
    if (error) {
      toast.error("Erro ao atualizar obra", { description: error.message });
      return;
    }
    if (arquivar && obraAtiva?.id === o.id) setObra(null);
    toast.success(arquivar ? "Obra arquivada" : "Obra reativada");
    void carregar();
  };

  const excluirObra = async () => {
    if (!obraParaExcluir) return;
    setExcluindo(true);
    const { error } = await supabase.from("obras").delete().eq("id", obraParaExcluir.id);
    setExcluindo(false);
    if (error) {
      toast.error("Erro ao excluir obra", {
        description:
          error.message.includes("foreign key") || error.message.includes("violates")
            ? "Existem dados vinculados (orçamento, RDOs, compras, etc.). Arquive a obra ao invés de excluir."
            : error.message,
      });
      return;
    }
    if (obraAtiva?.id === obraParaExcluir.id) setObra(null);
    toast.success("Obra excluída");
    setObraParaExcluir(null);
    void carregar();
  };

  const obrasFiltradas = obras.filter((o) => {
    if (filtroEmpresa !== "todas" && o.empresa_id !== filtroEmpresa) return false;
    const arquivada = o.status === "arquivada";
    if (filtroStatus === "ativas" && arquivada) return false;
    if (filtroStatus === "arquivadas" && !arquivada) return false;
    return true;
  });

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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Empresa:</Label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger className="w-[220px]">
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
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status:</Label>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="arquivadas">Arquivadas</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            const arquivada = o.status === "arquivada";
            return (
              <Card key={o.id} className={arquivada ? "opacity-70" : undefined}>
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
                      {arquivada && (
                        <Badge variant="outline" className="gap-1">
                          <Archive className="h-3 w-3" /> Arquivada
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
                    {!arquivada && (
                      <>
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
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => arquivarObra(o, !arquivada)}
                      title={arquivada ? "Reativar" : "Arquivar"}
                    >
                      {arquivada ? (
                        <>
                          <ArchiveRestore className="mr-2 h-4 w-4" /> Reativar
                        </>
                      ) : (
                        <>
                          <Archive className="mr-2 h-4 w-4" /> Arquivar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setObraParaExcluir(o)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog
        open={!!obraParaExcluir}
        onOpenChange={(open) => {
          if (!open) {
            setObraParaExcluir(null);
            setConfirmName("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obra "{obraParaExcluir?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Se a obra possui orçamento, RDOs, compras ou outros dados vinculados,
              a exclusão será bloqueada — nesse caso, use <strong>Arquivar</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-excluir-obra">
              Digite o nome da obra para confirmar:
            </Label>
            <Input
              id="confirm-excluir-obra"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={obraParaExcluir?.name ?? ""}
              disabled={excluindo}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void excluirObra();
              }}
              disabled={excluindo || confirmName !== obraParaExcluir?.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
