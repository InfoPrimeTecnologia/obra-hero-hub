import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/testes")({
  head: () => ({
    meta: [
      { title: "Testes grátis — Mestre 360 Admin" },
      { name: "description", content: "Acompanhe os testes grátis iniciados por e-mail e empresa." },
      { property: "og:title", content: "Testes grátis — Mestre 360 Admin" },
      { property: "og:description", content: "Acompanhe os testes grátis iniciados por e-mail e empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Row = {
  id: string;
  email: string;
  credits: number;
  started_at: string;
  ends_at: string;
  customer_id: string | null;
  customers: { name: string | null; company_name: string | null } | null;
  plans: { name: string } | null;
};

const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [converted, setConverted] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("trial_registrations")
        .select("id,email,credits,started_at,ends_at,customer_id,customers(name,company_name),plans(name)")
        .order("started_at", { ascending: false });
      const list = (data ?? []) as unknown as Row[];
      setRows(list);
      const ids = list.map((r) => r.customer_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: paid } = await supabase
          .from("invoices")
          .select("customer_id")
          .in("customer_id", ids)
          .eq("status", "paid")
          .gt("amount", 0);
        setConverted(new Set((paid ?? []).map((p) => p.customer_id)));
      }
    })();
  }, []);

  const now = Date.now();
  const filtered = useMemo(
    () => rows.filter((r) => `${r.email} ${r.customers?.company_name ?? ""} ${r.customers?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );
  const active = rows.filter((r) => new Date(r.ends_at).getTime() >= now).length;
  const conv = rows.filter((r) => r.customer_id && converted.has(r.customer_id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testes grátis"
        description="5 dias no plano mais completo com 100 créditos de IA. Cada e-mail só pode fazer um teste."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Testes iniciados", rows.length],
          ["Em andamento", active],
          ["Viraram assinantes", conv],
        ].map(([l, v]) => (
          <Card key={l as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-2xl font-semibold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Input placeholder="Buscar por e-mail ou empresa" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">E-mail</th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Plano</th>
                <th className="p-3">Créditos</th>
                <th className="p-3">Início</th>
                <th className="p-3">Fim</th>
                <th className="p-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isConv = r.customer_id && converted.has(r.customer_id);
                const isActive = new Date(r.ends_at).getTime() >= now;
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3">{r.email}</td>
                    <td className="p-3">{r.customers?.company_name || r.customers?.name || "—"}</td>
                    <td className="p-3">{r.plans?.name ?? "—"}</td>
                    <td className="p-3">{r.credits}</td>
                    <td className="p-3">{fmt(r.started_at)}</td>
                    <td className="p-3">{fmt(r.ends_at)}</td>
                    <td className="p-3">
                      {isConv ? (
                        <Badge>Assinante</Badge>
                      ) : isActive ? (
                        <Badge variant="secondary">Em teste</Badge>
                      ) : (
                        <Badge variant="outline">Encerrado</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum teste grátis ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
