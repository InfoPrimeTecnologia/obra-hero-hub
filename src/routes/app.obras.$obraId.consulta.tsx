import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Loader2, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/app/obras/$obraId/consulta")({
  component: ConsultaPage,
});

type Fornecedor = { id: string; nome: string };
type Compra = {
  id: string;
  numero: string | null;
  descricao: string | null;
  fornecedor_id: string | null;
  forma_pagamento: string | null;
  valor_total: number;
  data_compra: string;
  status: string;
  qtd_parcelas: number | null;
};

const formaLabels: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", boleto: "Boleto",
  cartao: "Cartão", transferencia: "Transferência",
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ConsultaPage() {
  const { obraId } = Route.useParams();

  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);

  const [fornecedorId, setFornecedorId] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id,nome")
        .eq("ativo", true)
        .order("nome");
      setFornecedores((data ?? []) as Fornecedor[]);
    })();
  }, []);

  const buscar = async () => {
    setLoading(true);
    let query = supabase
      .from("compras")
      .select("id,numero,descricao,fornecedor_id,forma_pagamento,valor_total,data_compra,status,qtd_parcelas")
      .eq("obra_id", obraId)
      .order("data_compra", { ascending: false });

    if (fornecedorId !== "todos") query = query.eq("fornecedor_id", fornecedorId);
    if (tipo !== "todos") query = query.eq("forma_pagamento", tipo);
    if (status !== "todos") query = query.eq("status", status);
    if (dataDe) query = query.gte("data_compra", dataDe);
    if (dataAte) query = query.lte("data_compra", dataAte);

    const { data } = await query;
    let list = (data ?? []) as Compra[];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((c) =>
        (c.numero ?? "").toLowerCase().includes(q) ||
        (c.descricao ?? "").toLowerCase().includes(q),
      );
    }
    setCompras(list);
    setLoading(false);
  };

  useEffect(() => { buscar(); /* eslint-disable-next-line */ }, [obraId]);

  const nomeFornecedor = (id: string | null) =>
    fornecedores.find((f) => f.id === id)?.nome ?? "—";

  const totais = useMemo(() => {
    const total = compras.reduce((s, c) => s + Number(c.valor_total || 0), 0);
    return { qtd: compras.length, total };
  }, [compras]);

  return (
    <div>
      <PageHeader
        title="Consulta de compras"
        info="Busque e filtre todas as compras desta obra por fornecedor, forma de pagamento, status, NF e período."
        description="Filtre compras da obra por fornecedor, tipo de pagamento e faturamento (período)"
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label>Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo (pagamento)</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(formaLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Faturamento de</Label>
              <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
            </div>
            <div>
              <Label>Faturamento até</Label>
              <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <Label>Buscar (nº / descrição)</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex: NF 123, cimento..." />
            </div>
            <div className="flex items-end md:col-span-2">
              <Button className="w-full" onClick={buscar} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totais.qtd} compra(s) encontrada(s)</span>
          <span>Total: <strong className="text-foreground">{brl(totais.total)}</strong></span>
        </div>

        {compras.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <FileSearch className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma compra encontrada com os filtros atuais.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {compras.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c.numero ?? "s/nº"}</span>
                      <Badge variant="outline">{nomeFornecedor(c.fornecedor_id)}</Badge>
                      <Badge variant="secondary">{c.forma_pagamento ? (formaLabels[c.forma_pagamento] ?? c.forma_pagamento) : "—"}</Badge>
                      {(() => {
                        const s = c.status;
                        if (s === "paga") return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">Paga</Badge>;
                        if (s === "parcial") return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Parcial</Badge>;
                        if (s === "faturada") return <Badge variant="secondary">Faturada</Badge>;
                        return <Badge variant="destructive">Pendente</Badge>;
                      })()}
                    </div>
                    {c.descricao && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">{c.descricao}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(c.data_compra).toLocaleDateString("pt-BR")}
                      {c.qtd_parcelas && c.qtd_parcelas > 0 ? ` · ${c.qtd_parcelas}x` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{brl(Number(c.valor_total))}</div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/obras/$obraId/compras/$compraId" params={{ obraId, compraId: c.id }}>
                      <Eye className="mr-2 h-4 w-4" /> Abrir
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
