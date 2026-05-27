import { useEffect, useState, type ChangeEvent } from "react";
import { FileText, Trash2, Upload, ScanLine, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type NF = {
  id: string;
  numero: string | null;
  serie: string | null;
  chave: string | null;
  valor: number | null;
  emitida_em: string | null;
  arquivo_nome: string | null;
  arquivo_url: string | null;
  observacoes: string | null;
  created_at: string;
};

type Props = {
  compraId: string;
  customerId: string;
  empresarial?: boolean;
};

// Extrai metadados básicos de um XML de NF-e
function parseNFeXml(xmlText: string): {
  numero?: string;
  serie?: string;
  chave?: string;
  valor?: number;
  emitida_em?: string;
} {
  try {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const get = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent ?? undefined;
    const infNFe = doc.getElementsByTagName("infNFe")[0];
    const chave = infNFe?.getAttribute("Id")?.replace(/^NFe/, "") ?? undefined;
    const dhEmi = get("dhEmi") ?? get("dEmi");
    return {
      numero: get("nNF"),
      serie: get("serie"),
      chave,
      valor: get("vNF") ? Number(get("vNF")) : undefined,
      emitida_em: dhEmi ? dhEmi.slice(0, 10) : undefined,
    };
  } catch {
    return {};
  }
}

export function CompraNotasFiscais({ compraId, customerId, empresarial = false }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<NF[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    numero: "", serie: "", chave: "", valor: "", emitida_em: "", observacoes: "",
  });
  const [arquivo, setArquivo] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("compra_notas_fiscais")
      .select("*")
      .eq("compra_id", compraId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as NF[]);
  };
  useEffect(() => { void load(); }, [compraId]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setArquivo(f);
    if (f && empresarial && /\.xml$/i.test(f.name)) {
      try {
        const text = await f.text();
        const parsed = parseNFeXml(text);
        setForm((p) => ({
          numero: parsed.numero ?? p.numero,
          serie: parsed.serie ?? p.serie,
          chave: parsed.chave ?? p.chave,
          valor: parsed.valor ? String(parsed.valor) : p.valor,
          emitida_em: parsed.emitida_em ?? p.emitida_em,
          observacoes: p.observacoes,
        }));
        toast.success("XML lido — campos preenchidos automaticamente");
      } catch {
        toast.error("Não foi possível ler o XML");
      }
    }
  };

  const salvar = async () => {
    if (!arquivo && !form.numero && !form.chave) {
      toast.error("Informe ao menos um arquivo ou número/chave da NF");
      return;
    }
    setUploading(true);
    try {
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      if (arquivo) {
        const path = `${customerId}/${compraId}/${Date.now()}-${arquivo.name}`;
        const { error: upErr } = await supabase.storage.from("notas-fiscais").upload(path, arquivo, {
          upsert: false,
          contentType: arquivo.type || undefined,
        });
        if (upErr) throw upErr;
        arquivo_url = path;
        arquivo_nome = arquivo.name;
      }
      const { error } = await supabase.from("compra_notas_fiscais").insert({
        compra_id: compraId,
        customer_id: customerId,
        numero: form.numero || null,
        serie: form.serie || null,
        chave: form.chave || null,
        valor: form.valor ? Number(form.valor) : null,
        emitida_em: form.emitida_em || null,
        observacoes: form.observacoes || null,
        arquivo_url, arquivo_nome,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Nota fiscal anexada");
      setForm({ numero: "", serie: "", chave: "", valor: "", emitida_em: "", observacoes: "" });
      setArquivo(null);
      const input = document.getElementById("nf-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (err: any) {
      toast.error("Erro ao anexar NF", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const excluir = async (nf: NF) => {
    if (!confirm("Excluir esta NF?")) return;
    if (nf.arquivo_url) {
      await supabase.storage.from("notas-fiscais").remove([nf.arquivo_url]);
    }
    const { error } = await supabase.from("compra_notas_fiscais").delete().eq("id", nf.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("NF removida");
    await load();
  };

  const baixar = async (nf: NF) => {
    if (!nf.arquivo_url) return;
    const { data, error } = await supabase.storage.from("notas-fiscais").createSignedUrl(nf.arquivo_url, 60);
    if (error || !data) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Notas Fiscais
          {empresarial && (
            <Badge variant="outline" className="ml-2 gap-1">
              <ScanLine className="h-3 w-3" /> Leitura XML
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nf-file">
                Arquivo (PDF/XML){empresarial ? " — XML é lido automaticamente" : ""}
              </Label>
              <Input id="nf-file" type="file" accept=".pdf,.xml,application/pdf,text/xml,application/xml" onChange={onFile} />
            </div>
            <div className="space-y-2">
              <Label>Emitida em</Label>
              <Input type="date" value={form.emitida_em} onChange={(e) => setForm({ ...form, emitida_em: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Série</Label>
              <Input value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Chave de acesso (44 dígitos)</Label>
              <Input value={form.chave} onChange={(e) => setForm({ ...form, chave: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-3">
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={salvar} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Anexar NF
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma nota fiscal anexada.</p>
        ) : (
          <div className="space-y-2">
            {items.map((nf) => (
              <div key={nf.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    NF {nf.numero ?? "—"}{nf.serie ? ` · Série ${nf.serie}` : ""}
                    {nf.valor ? <span className="ml-2 text-muted-foreground">R$ {Number(nf.valor).toFixed(2)}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {nf.emitida_em ? new Date(nf.emitida_em).toLocaleDateString("pt-BR") : "Sem data"}
                    {nf.chave ? ` · ${nf.chave}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {nf.arquivo_url && (
                    <Button variant="outline" size="sm" onClick={() => baixar(nf)}>Abrir arquivo</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => excluir(nf)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
