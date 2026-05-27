import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { Plus, Pencil, Trash2, Eye, UserPlus, Power } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCurrentCustomerId } from "@/lib/customer";
import { useObraSelecionada } from "@/lib/obra-context";
import { ObraScopeBadge } from "@/components/app/ObraScopeBadge";
import { toast } from "sonner";


export const Route = createFileRoute("/app/rh/colaboradores")({ component: Page });

const VINCULOS = ["CLT", "PJ", "MEI", "Autonomo", "Estagiario", "Temporario", "Terceirizado"] as const;

type Colab = {
  id: string; foto_url: string | null; nome: string; cpf: string | null; ctps: string | null;
  cargo: string | null; vinculo: string; data_entrada: string | null; data_saida: string | null;
  telefone: string | null; email: string | null; endereco: string | null;
  remuneracao: number; pix: string | null; observacoes: string | null;
  ativo: boolean; deleted_at: string | null;
};
type Obra = { id: string; name: string };

const initial = {
  nome: "", cpf: "", ctps: "", cargo: "", vinculo: "CLT",
  data_entrada: "", data_saida: "", telefone: "", email: "", endereco: "",
  remuneracao: 0, pix: "", observacoes: "",
};

function Page() {
  const { user } = useAuth();
  const { obra } = useObraSelecionada();
  const [items, setItems] = useState<Colab[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraVinculos, setObraVinculos] = useState<Map<string, Set<string>>>(new Map());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Colab | null>(null);
  const [form, setForm] = useState(initial);
  const [foto, setFoto] = useState<File | null>(null);
  const [vinculadas, setVinculadas] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Colab | null>(null);
  const [detailObras, setDetailObras] = useState<string[]>([]);
  const [showInativos, setShowInativos] = useState(false);
  const [q, setQ] = useState("");


  const load = async () => {
    const { data } = await supabase.from("colaboradores").select("*").is("deleted_at", null).order("nome");
    setItems((data ?? []) as Colab[]);
    const { data: o } = await supabase.from("obras").select("id,name").order("name");
    setObras((o ?? []) as Obra[]);
  };
  useEffect(() => { void load(); }, []);

  const reset = () => { setForm(initial); setEditing(null); setFoto(null); setVinculadas(new Set()); };

  const openEdit = async (c: Colab) => {
    setEditing(c);
    setForm({
      nome: c.nome, cpf: c.cpf ?? "", ctps: c.ctps ?? "", cargo: c.cargo ?? "", vinculo: c.vinculo,
      data_entrada: c.data_entrada ?? "", data_saida: c.data_saida ?? "",
      telefone: c.telefone ?? "", email: c.email ?? "", endereco: c.endereco ?? "",
      remuneracao: Number(c.remuneracao), pix: c.pix ?? "", observacoes: c.observacoes ?? "",
    });
    const { data } = await supabase.from("colaborador_obras").select("obra_id").eq("colaborador_id", c.id);
    setVinculadas(new Set((data ?? []).map((r) => r.obra_id as string)));
    setOpen(true);
  };

  const openDetail = async (c: Colab) => {
    setDetail(c);
    const { data } = await supabase.from("colaborador_obras").select("obra_id").eq("colaborador_id", c.id);
    setDetailObras((data ?? []).map((r) => r.obra_id as string));
  };

  const uploadFoto = async (customer_id: string): Promise<string | null> => {
    if (!foto) return null;
    const ext = foto.name.split(".").pop();
    const path = `${customer_id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("colaborador-fotos").upload(path, foto);
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("colaborador-fotos").getPublicUrl(path).data.publicUrl;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const customer_id = await getCurrentCustomerId();
    if (!customer_id) { setSaving(false); return toast.error("Conta não identificada"); }
    let foto_url = editing?.foto_url ?? null;
    if (foto) foto_url = await uploadFoto(customer_id);

    const payload = {
      nome: form.nome, cpf: form.cpf || null, ctps: form.ctps || null,
      cargo: form.cargo || null, vinculo: form.vinculo,
      data_entrada: form.data_entrada || null, data_saida: form.data_saida || null,
      telefone: form.telefone || null, email: form.email || null, endereco: form.endereco || null,
      remuneracao: Number(form.remuneracao) || 0, pix: form.pix || null,
      observacoes: form.observacoes || null, foto_url,
    };

    let colabId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("colaboradores").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase.from("colaboradores")
        .insert({ ...payload, customer_id, created_by: user!.id }).select().single();
      if (error || !data) { setSaving(false); return toast.error(error?.message); }
      colabId = data.id;
    }

    // sync vínculos
    if (colabId) {
      await supabase.from("colaborador_obras").delete().eq("colaborador_id", colabId);
      if (vinculadas.size > 0) {
        await supabase.from("colaborador_obras").insert(
          Array.from(vinculadas).map((obra_id) => ({ customer_id, colaborador_id: colabId!, obra_id }))
        );
      }
    }
    setSaving(false);
    toast.success(editing ? "Colaborador atualizado" : "Colaborador cadastrado");
    reset(); setOpen(false); void load();
  };

  const toggleAtivo = async (c: Colab) => {
    await supabase.from("colaboradores").update({ ativo: !c.ativo }).eq("id", c.id);
    toast.success(c.ativo ? "Inativado" : "Ativado"); void load();
  };

  const softDelete = async (id: string) => {
    await supabase.from("colaboradores").update({ deleted_at: new Date().toISOString(), ativo: false }).eq("id", id);
    toast.success("Excluído"); void load();
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => { setFoto(e.target.files?.[0] ?? null); };

  const obraName = (id: string) => obras.find((o) => o.id === id)?.name ?? "—";
  const filtered = items
    .filter((c) => showInativos || c.ativo)
    .filter((c) => !q || [c.nome, c.cpf, c.cargo, c.email].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Colaboradores" description="Cadastro de equipe própria, CLT, PJ, terceirizados"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Novo colaborador</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} colaborador</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {(foto || editing?.foto_url) ? (
                      <AvatarImage src={foto ? URL.createObjectURL(foto) : editing!.foto_url!} />
                    ) : <AvatarFallback>{form.nome.slice(0, 2).toUpperCase() || "??"}</AvatarFallback>}
                  </Avatar>
                  <div className="space-y-2"><Label>Foto</Label>
                    <Input type="file" accept="image/*" onChange={onFile} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Nome *</Label>
                    <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Cargo</Label>
                    <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>CPF</Label>
                    <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
                  <div className="space-y-2"><Label>CTPS</Label>
                    <Input value={form.ctps} onChange={(e) => setForm({ ...form, ctps: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Vínculo *</Label>
                    <Select value={form.vinculo} onValueChange={(v) => setForm({ ...form, vinculo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{VINCULOS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Data de entrada</Label>
                    <Input type="date" value={form.data_entrada} onChange={(e) => setForm({ ...form, data_entrada: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Data de saída</Label>
                    <Input type="date" value={form.data_saida} onChange={(e) => setForm({ ...form, data_saida: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Telefone</Label>
                    <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                  <div className="space-y-2"><Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Remuneração</Label>
                    <Input type="number" step="0.01" value={form.remuneracao}
                      onChange={(e) => setForm({ ...form, remuneracao: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>PIX</Label>
                    <Input value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Observações</Label>
                  <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Obras vinculadas</Label>
                  <div className="grid grid-cols-2 gap-2 rounded border p-3 max-h-40 overflow-y-auto">
                    {obras.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma obra cadastrada.</p>
                    ) : obras.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={vinculadas.has(o.id)} onCheckedChange={(v) => {
                          const n = new Set(vinculadas);
                          if (v) n.add(o.id); else n.delete(o.id);
                          setVinculadas(n);
                        }} />
                        {o.name}
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="space-y-3 p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInativos} onCheckedChange={setShowInativos} /> Mostrar inativos
          </label>
        </div>
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum colaborador.</CardContent></Card>
        ) : filtered.map((c) => (
          <Card key={c.id}><CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Avatar><AvatarImage src={c.foto_url ?? undefined} /><AvatarFallback><UserPlus className="h-4 w-4" /></AvatarFallback></Avatar>
              <div>
                <p className="font-medium">{c.nome} {!c.ativo && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">inativo</span>}</p>
                <p className="text-xs text-muted-foreground">{[c.cargo, c.vinculo, c.cpf].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => openDetail(c)}><Eye className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleAtivo(c)}><Power className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação remove o cadastro (soft delete).</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => softDelete(c.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detail?.nome}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16"><AvatarImage src={detail.foto_url ?? undefined} /><AvatarFallback>{detail.nome.slice(0, 2)}</AvatarFallback></Avatar>
                <div><p className="font-medium">{detail.cargo ?? "—"}</p><p className="text-xs text-muted-foreground">{detail.vinculo}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2"><div><b>CPF:</b> {detail.cpf ?? "—"}</div><div><b>CTPS:</b> {detail.ctps ?? "—"}</div></div>
              <div className="grid grid-cols-2 gap-2"><div><b>Tel:</b> {detail.telefone ?? "—"}</div><div><b>E-mail:</b> {detail.email ?? "—"}</div></div>
              <div><b>Endereço:</b> {detail.endereco ?? "—"}</div>
              <div className="grid grid-cols-2 gap-2"><div><b>Entrada:</b> {detail.data_entrada ?? "—"}</div><div><b>Saída:</b> {detail.data_saida ?? "—"}</div></div>
              <div className="grid grid-cols-2 gap-2"><div><b>Remuneração:</b> R$ {Number(detail.remuneracao).toFixed(2)}</div><div><b>PIX:</b> {detail.pix ?? "—"}</div></div>
              <div><b>Obras:</b> {detailObras.length === 0 ? "—" : detailObras.map(obraName).join(", ")}</div>
              {detail.observacoes && <div><b>Obs:</b> {detail.observacoes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
