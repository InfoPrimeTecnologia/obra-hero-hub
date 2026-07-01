import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload, Download, Trash2, FileText, Tag as TagIcon, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/documentos")({
  component: DocumentosPage,
});

type Doc = {
  id: string;
  customer_id: string;
  obra_id: string;
  nome: string;
  descricao: string | null;
  tags: string[];
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

function formatSize(b?: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function DocumentosPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data: obra } = await supabase
      .from("obras")
      .select("customer_id")
      .eq("id", obraId)
      .maybeSingle();
    if (obra?.customer_id) setCustomerId(obra.customer_id);

    const { data, error } = await supabase
      .from("obra_documentos")
      .select("*")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao listar documentos", { description: error.message });
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [obraId]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    docs.forEach((d) => d.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (filterTag && !d.tags?.includes(filterTag)) return false;
      if (!term) return true;
      return (
        d.nome.toLowerCase().includes(term) ||
        (d.descricao ?? "").toLowerCase().includes(term) ||
        d.tags?.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [docs, q, filterTag]);

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setTagsStr("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    if (!customerId) return toast.error("Empresa não identificada");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${customerId}/${obraId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("obra-documentos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error: insErr } = await supabase.from("obra_documentos").insert({
        customer_id: customerId,
        obra_id: obraId,
        nome: nome.trim() || file.name,
        descricao: descricao.trim() || null,
        tags,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      toast.success("Documento enviado");
      resetForm();
      setOpen(false);
      void load();
    } catch (e: any) {
      toast.error("Erro ao enviar", { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("obra-documentos")
      .createSignedUrl(d.file_path, 60);
    if (error || !data) return toast.error("Não foi possível gerar link", { description: error?.message });
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    await supabase.storage.from("obra-documentos").remove([toDelete.file_path]);
    const { error } = await supabase.from("obra_documentos").delete().eq("id", toDelete.id);
    if (error) return toast.error("Erro ao excluir", { description: error.message });
    toast.success("Documento excluído");
    setToDelete(null);
    void load();
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos da obra</h1>
          <p className="text-sm text-muted-foreground">
            Centralize contratos, plantas, licenças, ARTs e demais anexos com tags.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Upload className="mr-2 h-4 w-4" />Novo documento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Enviar documento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Arquivo *</Label>
                <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Contrato assinado" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="contrato, jurídico, cliente"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, descrição ou tag" className="pl-8" />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              variant={filterTag === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterTag(null)}
            >
              Todas
            </Badge>
            {allTags.map((t) => (
              <Badge
                key={t}
                variant={filterTag === t ? "default" : "outline"}
                className="cursor-pointer gap-1"
                onClick={() => setFilterTag(filterTag === t ? null : t)}
              >
                <TagIcon className="h-3 w-3" />{t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum documento {docs.length === 0 ? "cadastrado ainda" : "corresponde ao filtro"}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{d.nome}</p>
                    {d.tags?.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        <TagIcon className="h-3 w-3" />{t}
                      </Badge>
                    ))}
                  </div>
                  {d.descricao && <p className="truncate text-xs text-muted-foreground">{d.descricao}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(d.file_size)} · {new Date(d.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d)}>
                    <Download className="mr-1 h-4 w-4" />Baixar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToDelete(d)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{toDelete?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>O arquivo será removido definitivamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
