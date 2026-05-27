import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { deleteCustomerAndUser } from "@/lib/admin-users.functions";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Pencil, Trash2, Eye, Search, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/empresas")({
  component: EmpresasPage,
});

type Customer = {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  created_at: string;
  owner_user_id: string | null;
};

type Plan = { id: string; name: string; price: number; cycle: string; modules?: any; features?: any };
type Subscription = {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  price: number;
  cycle: string;
  next_due_date: string | null;
  started_at: string;
  canceled_at: string | null;
};
type Invoice = {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  description: string | null;
};

type Metrics = {
  obras: number;
  rdos: number;
  compras: number;
  fornecedores: number;
  totalPago: number;
  totalAberto: number;
};

const STATUSES = ["active", "inactive", "overdue", "canceled"];

function EmpresasPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subs, setSubs] = useState<Record<string, Subscription>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // create/edit
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    cpf_cnpj: "",
    phone: "",
    whatsapp: "",
    status: "active",
  });

  // delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteCustomerFn = useServerFn(deleteCustomerAndUser);

  // assign plan
  const [assignCustomer, setAssignCustomer] = useState<Customer | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({
    plan_id: "",
    price: "",
    cycle: "monthly",
    due_day: 10,
    activate_now: true,
  });

  // detail
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cs, error }, { data: ss }, { data: ps }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, email, company_name, cpf_cnpj, phone, whatsapp, status, created_at, owner_user_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("id, customer_id, plan_id, status, price, cycle, next_due_date, started_at, canceled_at")
        .neq("status", "canceled"),
      supabase.from("plans").select("id, name, price, cycle, modules, features").eq("is_active", true).order("display_order"),
    ]);
    if (error) {
      toast.error("Erro ao carregar empresas", { description: error.message });
    } else {
      setCustomers((cs ?? []) as Customer[]);
      const map: Record<string, Subscription> = {};
      (ss ?? []).forEach((s) => {
        map[s.customer_id as string] = s as Subscription;
      });
      setSubs(map);
      setPlans((ps ?? []) as Plan[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const planById = useMemo(() => {
    const m: Record<string, Plan> = {};
    plans.forEach((p) => (m[p.id] = p));
    return m;
  }, [plans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company_name ?? "").toLowerCase().includes(q) ||
        (c.cpf_cnpj ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const reset = () => {
    setForm({ name: "", company_name: "", email: "", cpf_cnpj: "", phone: "", whatsapp: "", status: "active" });
    setEditingId(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      company_name: c.company_name ?? "",
      email: c.email,
      cpf_cnpj: c.cpf_cnpj ?? "",
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      status: c.status,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      email: form.email,
      company_name: form.company_name || null,
      cpf_cnpj: form.cpf_cnpj || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      status: form.status as "active" | "inactive" | "canceled" | "overdue",
    };
    const { error } = editingId
      ? await supabase.from("customers").update(payload).eq("id", editingId)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) {
      const msg = error.message.includes("customers_email_unique_ci")
        ? "Já existe uma empresa com este e-mail."
        : error.message;
      toast.error(editingId ? "Erro ao atualizar" : "Erro ao cadastrar", { description: msg });
      return;
    }
    toast.success(editingId ? "Empresa atualizada" : "Empresa cadastrada");
    reset();
    setOpen(false);
    void load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await deleteCustomerFn({ data: { customerId: deleteId } });
      if (!r.ok) {
        toast.error("Erro ao excluir", { description: r.error });
        return;
      }
      if ("warning" in r && r.warning) {
        toast.warning(r.warning);
      } else {
        toast.success("Empresa e usuário excluídos");
      }
      setDeleteId(null);
      void load();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e?.message });
    } finally {
      setDeleting(false);
    }
  };

  const openAssign = (c: Customer) => {
    setAssignCustomer(c);
    const current = subs[c.id];
    const defaultPlan = current ? plans.find((p) => p.id === current.plan_id) : plans[0];
    setAssignForm({
      plan_id: defaultPlan?.id ?? "",
      price: defaultPlan ? String(defaultPlan.price) : "",
      cycle: defaultPlan?.cycle ?? "monthly",
      due_day: current?.next_due_date ? new Date(current.next_due_date).getDate() : 10,
      activate_now: true,
    });
  };

  const handleAssignPlan = async () => {
    if (!assignCustomer || !assignForm.plan_id) return;
    setAssigning(true);
    try {
      const today = new Date();
      const nextDue = new Date(today);
      nextDue.setMonth(nextDue.getMonth() + (assignForm.cycle === "yearly" ? 12 : 1));
      const dueDay = Math.min(Math.max(assignForm.due_day || 10, 1), 28);

      // Cancela assinaturas ativas anteriores
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("customer_id", assignCustomer.id)
        .neq("status", "canceled");

      // Cria nova assinatura
      const { data: newSub, error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          customer_id: assignCustomer.id,
          plan_id: assignForm.plan_id,
          status: "active",
          cycle: assignForm.cycle as any,
          price: Number(assignForm.price || 0),
          due_day: dueDay,
          next_due_date: nextDue.toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (subErr) throw subErr;

      // Se "ativar imediatamente", cria fatura paga (libera o gate de acesso)
      if (assignForm.activate_now) {
        const planName = plans.find((p) => p.id === assignForm.plan_id)?.name ?? "Plano";
        const { error: invErr } = await supabase.from("invoices").insert({
          customer_id: assignCustomer.id,
          subscription_id: newSub!.id,
          amount: Number(assignForm.price || 0),
          status: "paid",
          due_date: today.toISOString().slice(0, 10),
          paid_at: new Date().toISOString(),
          description: `Ativação manual — ${planName} (Super Admin)`,
          payment_method: "undefined" as any,
        });
        if (invErr) throw invErr;
      }

      toast.success("Plano atribuído", {
        description: assignForm.activate_now
          ? "Funcionalidades liberadas imediatamente."
          : "Aguardando confirmação de pagamento para liberar acesso.",
      });
      setAssignCustomer(null);
      void load();
    } catch (e: any) {
      toast.error("Erro ao atribuir plano", { description: e?.message });
    } finally {
      setAssigning(false);
    }
  };

  const openDetail = async (c: Customer) => {
    setDetailCustomer(c);
    setMetrics(null);
    setInvoices([]);
    setLoadingDetail(true);
    const [obrasR, rdosR, comprasR, fornR, invR] = await Promise.all([
      supabase.from("obras").select("id", { count: "exact", head: true }).eq("customer_id", c.id),
      supabase.from("rdos").select("id", { count: "exact", head: true }).eq("customer_id", c.id),
      supabase.from("compras").select("id", { count: "exact", head: true }).eq("customer_id", c.id),
      supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("customer_id", c.id),
      supabase
        .from("invoices")
        .select("id, amount, status, due_date, paid_at, description")
        .eq("customer_id", c.id)
        .order("due_date", { ascending: false })
        .limit(20),
    ]);
    const inv = (invR.data ?? []) as Invoice[];
    const totalPago = inv.filter((i) => i.status === "paid").reduce((a, b) => a + Number(b.amount), 0);
    const totalAberto = inv
      .filter((i) => i.status !== "paid" && i.status !== "canceled")
      .reduce((a, b) => a + Number(b.amount), 0);
    setMetrics({
      obras: obrasR.count ?? 0,
      rdos: rdosR.count ?? 0,
      compras: comprasR.count ?? 0,
      fornecedores: fornR.count ?? 0,
      totalPago,
      totalAberto,
    });
    setInvoices(inv);
    setLoadingDetail(false);
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Gerencie as empresas cadastradas na plataforma"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova empresa
          </Button>
        }
      />
      <div className="space-y-4 p-8">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhuma empresa encontrada.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const sub = subs[c.id];
                    const plan = sub ? planById[sub.plan_id] : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.company_name ?? "—"}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email}</TableCell>
                        <TableCell>
                          {plan ? (
                            <span className="text-sm">
                              {plan.name}
                              <span className="text-muted-foreground"> · {fmtBRL(Number(sub.price))}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === "active" ? "default" : "secondary"}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openDetail(c)} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(c.id)}
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar empresa" : "Cadastrar empresa"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize os dados da empresa." : "Adicione uma nova empresa cliente ao sistema."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">Nome do responsável *</Label>
              <Input id="c-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-company">Nome da empresa</Label>
              <Input id="c-company" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">E-mail *</Label>
              <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-cpf">CPF / CNPJ</Label>
                <Input id="c-cpf" value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-phone">Telefone</Label>
                <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-wpp">WhatsApp</Label>
                <Input id="c-wpp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados vinculados precisam ser removidos previamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail dialog */}
      <Dialog open={!!detailCustomer} onOpenChange={(o) => !o && setDetailCustomer(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailCustomer?.company_name ?? detailCustomer?.name}</DialogTitle>
            <DialogDescription>{detailCustomer?.email}</DialogDescription>
          </DialogHeader>
          {loadingDetail || !metrics ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : detailCustomer ? (
            <div className="space-y-6">
              {/* Plano */}
              <Card>
                <CardHeader><CardTitle className="text-base">Plano e assinatura</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const sub = subs[detailCustomer.id];
                    const plan = sub ? planById[sub.plan_id] : null;
                    if (!sub) return <p className="text-sm text-muted-foreground">Sem assinatura ativa.</p>;
                    return (
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div><div className="text-muted-foreground">Plano</div><div className="font-medium">{plan?.name ?? "—"}</div></div>
                        <div><div className="text-muted-foreground">Valor</div><div className="font-medium">{fmtBRL(Number(sub.price))}</div></div>
                        <div><div className="text-muted-foreground">Ciclo</div><div className="font-medium">{sub.cycle}</div></div>
                        <div><div className="text-muted-foreground">Próx. venc.</div><div className="font-medium">{sub.next_due_date ?? "—"}</div></div>
                        <div><div className="text-muted-foreground">Status</div><div className="font-medium">{sub.status}</div></div>
                        <div><div className="text-muted-foreground">Início</div><div className="font-medium">{new Date(sub.started_at).toLocaleDateString("pt-BR")}</div></div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Métricas de uso */}
              <Card>
                <CardHeader><CardTitle className="text-base">Métricas de uso</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Metric label="Obras" value={metrics.obras} />
                    <Metric label="RDOs" value={metrics.rdos} />
                    <Metric label="Compras" value={metrics.compras} />
                    <Metric label="Fornecedores" value={metrics.fornecedores} />
                  </div>
                </CardContent>
              </Card>

              {/* Faturamento */}
              <Card>
                <CardHeader><CardTitle className="text-base">Faturamento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Metric label="Total pago" value={fmtBRL(metrics.totalPago)} />
                    <Metric label="Em aberto" value={fmtBRL(metrics.totalAberto)} />
                  </div>
                  {invoices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell>{i.description ?? "—"}</TableCell>
                            <TableCell>{new Date(i.due_date).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell>{fmtBRL(Number(i.amount))}</TableCell>
                            <TableCell><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma fatura registrada.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
