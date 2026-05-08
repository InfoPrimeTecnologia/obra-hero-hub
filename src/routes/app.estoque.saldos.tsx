import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/estoque/saldos")({ component: Page });

type Saldo = { id: string; produto_id: string; almoxarifado_id: string; quantidade: number; custo_medio: number };
type Produto = { id: string; nome: string; unidade: string; estoque_minimo: number };
type Almox = { id: string; nome: string };

function Page() {
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [almox, setAlmox] = useState<Almox[]>([]);
  const [almoxId, setAlmoxId] = useState<string>("all");
  const [q, setQ] = useState("");

  const load = async () => {
    const [s, p, a] = await Promise.all([
      supabase.from("estoque_saldos").select("*"),
      supabase.from("produtos").select("id,nome,unidade,estoque_minimo").eq("ativo", true),
      supabase.from("almoxarifados").select("id,nome").eq("ativo", true),
    ]);
    if (s.error) return toast.error(s.error.message);
    setSaldos((s.data ?? []) as Saldo[]);
    setProdutos((p.data ?? []) as Produto[]);
    setAlmox((a.data ?? []) as Almox[]);
  };
  useEffect(() => { void load(); }, []);

  const prodMap = new Map(produtos.map((p) => [p.id, p]));
  const almoxMap = new Map(almox.map((a) => [a.id, a]));

  const rows = saldos
    .filter((s) => almoxId === "all" || s.almoxarifado_id === almoxId)
    .filter((s) => {
      const p = prodMap.get(s.produto_id);
      return !q || (p?.nome ?? "").toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => (prodMap.get(a.produto_id)?.nome ?? "").localeCompare(prodMap.get(b.produto_id)?.nome ?? ""));

  return (
    <div>
      <PageHeader title="Saldos de Estoque" description="Quantidade e custo médio por produto e almoxarifado" />
      <div className="space-y-3 p-8">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Buscar produto..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={almoxId} onValueChange={setAlmoxId}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os almoxarifados</SelectItem>
              {almox.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum saldo.</CardContent></Card>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-left">Almoxarifado</th>
                <th className="p-3 text-right">Quantidade</th>
                <th className="p-3 text-right">Custo médio</th>
                <th className="p-3 text-right">Total</th>
              </tr></thead>
              <tbody>
                {rows.map((s) => {
                  const p = prodMap.get(s.produto_id);
                  const a = almoxMap.get(s.almoxarifado_id);
                  const baixo = p && Number(s.quantidade) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0;
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="p-3 flex items-center gap-2">
                        <ListTree className="h-4 w-4 text-muted-foreground" />
                        {p?.nome ?? "—"}
                        {baixo && <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">baixo</span>}
                      </td>
                      <td className="p-3">{a?.nome ?? "—"}</td>
                      <td className="p-3 text-right">{Number(s.quantidade).toFixed(2)} {p?.unidade}</td>
                      <td className="p-3 text-right">R$ {Number(s.custo_medio).toFixed(2)}</td>
                      <td className="p-3 text-right">R$ {(Number(s.quantidade) * Number(s.custo_medio)).toFixed(2)}</td>
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
