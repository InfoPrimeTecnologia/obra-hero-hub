import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Shuffle, History, Pencil } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generateCouponCode, normalizeCode } from "@/lib/coupons";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cupons")({
  head: () => ({
    meta: [
      { title: "Cupons — Mestre 360 Admin" },
      { name: "description", content: "Gerencie cupons de desconto e acompanhe seus usos." },
      { property: "og:title", content: "Cupons — Mestre 360 Admin" },
      { property: "og:description", content: "Gerencie cupons de desconto e acompanhe seus usos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Coupon = {
  id: string; code: string; percent: number; description: string | null;
  expires_at: string | null; max_uses: number | null; is_active: boolean; created_at: string;
};
type Redemption = {
  id: string; coupon_id: string; code: string; percent: number; original_amount: number;
  discount_amount: number; final_amount: number; created_at: string;
  customers: { name: string | null; company_name: string | null } | null;
  plan_id: string | null;
};

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s: string) => new Date(s).toLocaleString("pt-BR");
const initial = { code: "", percent: "10", description: "", expires_at: "", max_uses: "", is_active: true };

function Page() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [uses, setUses] = useState<Redemption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [planNames, setPlanNames] = useState<Record<string, string>>({});
  const [historyOf, setHistoryOf] = useState<Coupon | null>(null);

  const load = async () => {
    const [c, r, p] = await Promise.all([
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase
        .from("coupon_redemptions")
        .select("*, customers(name, company_name)")
        .order("created_at", { ascending: false }),
      supabase.from("plans").select("id, name"),
    ]);
    setPlanNames(Object.fromEntries((p.data ?? []).map((x) => [x.id, x.name])));
    if (c.error) return toast.error(c.error.message);
    setItems((c.data ?? []) as unknown as Coupon[]);
    setUses((r.data ?? []) as unknown as Redemption[]);
  };
  useEffect(() => { void load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...initial, code: generateCouponCode() }); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code, percent: String(c.percent), description: c.description ?? "",
      expires_at: c.expires_at ?? "", max_uses: c.max_uses ? String(c.max_uses) : "", is_active: c.is_active,
    });
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const percent = Number(form.percent);
    if (!(percent > 0 && percent <= 100)) return toast.error("Porcentagem deve ser entre 0 e 100");
    const payload = {
      code: normalizeCode(form.code), percent, description: form.description || null,
      expires_at: form.expires_at || null, max_uses: form.max_uses ? Number(form.max_uses) : null,
      is_active: form.is_active,
    };
    if (!payload.code) return toast.error("Informe o código");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = editing
      ? await supabase.from("coupons").update(payload).eq("id", editing.id)
      : await supabase.from("coupons").insert({ ...payload, created_by: u.user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "Já existe um cupom com esse código" : error.message);
    toast.success(editing ? "Cupom atualizado" : "Cupom criado");
    setOpen(false);
    void load();
  };

  const toggle = async (c: Coupon) => {
    const { error } = await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const countOf = (id: string) => uses.filter((u) => u.coupon_id === id).length;
  const today = new Date().toISOString().slice(0, 10);
  const history = historyOf ? uses.filter((u) => u.coupon_id === historyOf.id) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cupons"
        description="Desconto percentual aplicado somente na 1ª mensalidade. Cada empresa usa um cupom uma única vez."
        actions={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo cupom</Button>}
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Código</th><th className="p-3">Desconto</th><th className="p-3">Validade</th>
                <th className="p-3">Usos</th><th className="p-3">Último uso</th><th className="p-3">Status</th><th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum cupom criado.</td></tr>
              )}
              {items.map((c) => {
                const n = countOf(c.id);
                const last = uses.find((u) => u.coupon_id === c.id);
                const expired = !!c.expires_at && c.expires_at < today;
                const exhausted = c.max_uses != null && n >= c.max_uses;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-3 font-mono font-semibold">{c.code}
                      {c.description && <div className="font-sans text-xs font-normal text-muted-foreground">{c.description}</div>}
                    </td>
                    <td className="p-3">{Number(c.percent)}%</td>
                    <td className="p-3">{c.expires_at ? new Date(c.expires_at + "T12:00:00").toLocaleDateString("pt-BR") : "Sem validade"}</td>
                    <td className="p-3">{n}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                    <td className="p-3">{last ? dt(last.created_at) : "—"}</td>
                    <td className="p-3">
                      {expired ? <Badge variant="secondary">Expirado</Badge>
                        : exhausted ? <Badge variant="secondary">Esgotado</Badge>
                        : c.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Switch checked={c.is_active} onCheckedChange={() => toggle(c)} aria-label="Ativar cupom" />
                        <Button size="icon" variant="ghost" onClick={() => setHistoryOf(c)} aria-label="Histórico de usos"><History className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-code">Código</Label>
              <div className="flex gap-2">
                <Input id="cp-code" value={form.code} className="font-mono uppercase"
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, code: generateCouponCode() })}>
                  <Shuffle className="mr-2 h-4 w-4" />Gerar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-pct">Desconto (%)</Label>
                <Input id="cp-pct" type="number" min="0.01" max="100" step="0.01" required value={form.percent}
                  onChange={(e) => setForm({ ...form, percent: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-max">Máximo de usos</Label>
                <Input id="cp-max" type="number" min="1" placeholder="Ilimitado" value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-exp">Válido até</Label>
              <Input id="cp-exp" type="date" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-desc">Observação (interna)</Label>
              <Input id="cp-desc" value={form.description} placeholder="Ex.: campanha Instagram"
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} id="cp-active" />
              <Label htmlFor="cp-active">Ativo</Label>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyOf} onOpenChange={(v) => !v && setHistoryOf(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Usos do cupom {historyOf?.code}</DialogTitle></DialogHeader>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Este cupom ainda não foi usado.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="p-2">Data/hora</th><th className="p-2">Empresa</th><th className="p-2">Plano</th><th className="p-2 text-right">Desconto</th><th className="p-2 text-right">Pago</th></tr>
                </thead>
                <tbody>
                  {history.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-2">{dt(u.created_at)}</td>
                      <td className="p-2">{u.customers?.company_name || u.customers?.name || "—"}</td>
                      <td className="p-2">{(u.plan_id && planNames[u.plan_id]) || "—"}</td>
                      <td className="p-2 text-right">{brl(u.discount_amount)} ({Number(u.percent)}%)</td>
                      <td className="p-2 text-right">{brl(u.final_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
