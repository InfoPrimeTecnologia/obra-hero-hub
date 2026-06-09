import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, Package, Pencil, Trash2, Upload, ImageIcon, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCurrentCustomerId } from "@/lib/customer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/estoque/produtos")({ component: Page });

type Produto = {
  id: string; codigo: string | null; nome: string; descricao: string | null;
  unidade: string; categoria: string | null; marca: string | null; ncm: string | null;
  custo_medio: number; estoque_minimo: number; ativo: boolean; foto_url: string | null;
};
type Saldo = { produto_id: string; quantidade: number };

const initial = {
  codigo: "", nome: "", descricao: "", unidade: "un", categoria: "",
  marca: "", ncm: "", estoque_minimo: 0, foto_url: "",
};
const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<Produto[]>([]);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [p, s] = await Promise.all([
      supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
      supabase.from("estoque_saldos").select("produto_id,quantidade"),
    ]);
    if (p.error) return toast.error(p.error.message);
    setItems((p.data ?? []) as Produto[]);
    setSaldos((s.data ?? []) as Saldo[]);
  };
  useEffect(() => { void load(); }, []);

  const saldoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of saldos) m.set(r.produto_id, (m.get(r.produto_id) ?? 0) + Number(r.quantidade));
    return m;
  }, [saldos]);

  const categorias = useMemo(
    () => Array.from(new Set(items.map((p) => p.categoria).filter(Boolean))) as string[],
    [items],
  );

  const stats = useMemo(() => {
    let total = 0, valor = 0, baixo = 0, semFoto = 0;
    for (const p of items) {
      total++;
      const qtd = saldoMap.get(p.id) ?? 0;
      valor += qtd * Number(p.custo_medio);
      if (Number(p.estoque_minimo) > 0 && qtd <= Number(p.estoque_minimo)) baixo++;
      if (!p.foto_url) semFoto++;
    }
    return { total, valor, baixo, semFoto };
  }, [items, saldoMap]);

  const reset = () => { setForm(initial); setEditing(null); };
  const edit = (p: Produto) => {
    setEditing(p);
    setForm({
      codigo: p.codigo ?? "", nome: p.nome, descricao: p.descricao ?? "",
      unidade: p.unidade, categoria: p.categoria ?? "",
      marca: p.marca ?? "", ncm: p.ncm ?? "",
      estoque_minimo: Number(p.estoque_minimo),
      foto_url: p.foto_url ?? "",
    });
    setOpen(true);
  };

  const uploadFoto = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem deve ter no máximo 5MB");
    setUploading(true);
    const customer_id = await getCurrentCustomerId();
    if (!customer_id) { setUploading(false); return toast.error("Conta não identificada"); }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${customer_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("produto-fotos").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("produto-fotos").getPublicUrl(path);
    setForm((f) => ({ ...f, foto_url: data.publicUrl }));
    setUploading(false);
    toast.success("Foto enviada");
  };


  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      codigo: form.codigo || null, nome: form.nome, descricao: form.descricao || null,
      unidade: form.unidade || "un", categoria: form.categoria || null,
      marca: form.marca || null, ncm: form.ncm || null,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      foto_url: form.foto_url || null,
    };
    if (editing) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Produto atualizado");
    } else {
      const customer_id = await getCurrentCustomerId();
      if (!customer_id) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("produtos").insert({ ...payload, customer_id, created_by: user!.id });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Produto cadastrado");
    }
    reset(); setOpen(false); void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); void load();
  };

  const filtered = items
    .filter((p) => cat === "all" || p.categoria === cat)
    .filter((p) =>
      [p.nome, p.codigo, p.categoria, p.marca].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()),
    );

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catálogo de itens do estoque com foto, marca e estoque mínimo"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Novo produto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="relative h-28 w-28 overflow-hidden rounded-lg border bg-muted">
                      {form.foto_url ? (
                        <img src={form.foto_url} alt="Produto" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && void uploadFoto(e.target.files[0])}
                    />
                    <Button type="button" variant="outline" size="sm" className="mt-2 w-28"
                      onClick={() => fileRef.current?.click()} disabled={uploading}>
                      <Upload className="mr-2 h-3 w-3" /> {uploading ? "..." : "Foto"}
                    </Button>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2"><Label>Código</Label>
                        <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
                      <div className="col-span-2 space-y-2"><Label>Nome *</Label>
                        <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Marca</Label>
                        <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Categoria</Label>
                        <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Unidade</Label>
                    <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Estoque mínimo</Label>
                    <Input type="number" step="0.01" value={form.estoque_minimo}
                      onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>NCM</Label>
                    <Input value={form.ncm} onChange={(e) => setForm({ ...form, ncm: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Descrição</Label>
                  <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-4 p-8">
        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Itens cadastrados</p>
            <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor em estoque</p>
            <p className="mt-1 text-2xl font-semibold">{BRL(stats.valor)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Estoque baixo</p>
            <p className="mt-1 text-2xl font-semibold text-destructive">{stats.baixo}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sem foto</p>
            <p className="mt-1 text-2xl font-semibold text-muted-foreground">{stats.semFoto}</p>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar por nome, código, marca..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto flex rounded-md border">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setView("grid")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum produto.</CardContent></Card>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const qtd = saldoMap.get(p.id) ?? 0;
              const baixo = Number(p.estoque_minimo) > 0 && qtd <= Number(p.estoque_minimo);
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nome} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                    )}
                    {baixo && (
                      <Badge variant="destructive" className="absolute right-2 top-2 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Baixo
                      </Badge>
                    )}
                  </div>
                  <CardContent className="space-y-2 p-3">
                    <div>
                      <p className="line-clamp-1 font-medium">{p.nome}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {[p.codigo, p.marca, p.categoria].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-end justify-between border-t pt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Estoque</p>
                        <p className={`text-sm font-semibold ${baixo ? "text-destructive" : ""}`}>
                          {qtd.toFixed(2)} {p.unidade}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Custo médio</p>
                        <p className="text-sm font-semibold">{BRL(Number(p.custo_medio))}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => edit(p)}>
                        <Pencil className="mr-1 h-3 w-3" /> Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remover produto?</AlertDialogTitle>
                            <AlertDialogDescription>O produto será inativado.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(p.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-left">Categoria</th>
                <th className="p-3 text-right">Estoque</th>
                <th className="p-3 text-right">Custo médio</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => {
                  const qtd = saldoMap.get(p.id) ?? 0;
                  const baixo = Number(p.estoque_minimo) > 0 && qtd <= Number(p.estoque_minimo);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded border bg-muted">
                            {p.foto_url
                              ? <img src={p.foto_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                          </div>
                          <div>
                            <p className="font-medium">{p.nome}</p>
                            <p className="text-xs text-muted-foreground">{[p.codigo, p.marca].filter(Boolean).join(" · ") || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{p.categoria ?? "—"}</td>
                      <td className={`p-3 text-right ${baixo ? "text-destructive font-medium" : ""}`}>
                        {qtd.toFixed(2)} {p.unidade}
                      </td>
                      <td className="p-3 text-right">{BRL(Number(p.custo_medio))}</td>
                      <td className="p-3 text-right">{BRL(qtd * Number(p.custo_medio))}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Remover?</AlertDialogTitle>
                              <AlertDialogDescription>O produto será inativado.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(p.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
