import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  adminListInvoices,
  adminSyncInvoice,
  adminSyncPendingInvoices,
} from "@/lib/admin-billing.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Loader2, RefreshCw, RotateCw, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/faturas")({ component: FaturasPage });

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
  canceled: "Cancelado",
  refunded: "Estornado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  paid: "default",
  overdue: "destructive",
  canceled: "secondary",
  refunded: "secondary",
};

function fmtBRL(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FaturasPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListInvoices);
  const syncOne = useServerFn(adminSyncInvoice);
  const syncAll = useServerFn(adminSyncPendingInvoices);
  const [status, setStatus] = useState<any>("all");
  const [q, setQ] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-invoices", status, q],
    queryFn: () => listFn({ data: { status, q: q || undefined, limit: 200 } }),
  });

  const syncOneMut = useMutation({
    mutationFn: (invoiceId: string) => syncOne({ data: { invoiceId } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      if (r.error) {
        toast.error("Falha ao sincronizar", { description: r.error });
      } else if (r.skipped) {
        toast.info("Sem ID Asaas para sincronizar");
      } else if (r.credited) {
        toast.success(`Creditado: +${r.creditsAdded} créditos`, {
          description: `Status: ${r.previousStatus} → ${r.newStatus}`,
        });
      } else if (r.previousStatus !== r.newStatus) {
        toast.success(`Status atualizado: ${r.previousStatus} → ${r.newStatus}`);
      } else {
        toast.info(`Sem alterações (status: ${r.newStatus})`);
      }
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
    onSettled: () => setSyncingId(null),
  });

  const syncAllMut = useMutation({
    mutationFn: () => syncAll({ data: { days: 14 } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      toast.success("Sincronização concluída", {
        description: `${r.total} verificadas · ${r.updated} atualizadas · ${r.credited} creditadas`,
      });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Faturas"
        description="Faturas geradas pelo sistema (assinaturas e recargas de créditos)"
      />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                  <SelectItem value="refunded">Estornado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar por descrição ou ID Asaas"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-72"
              />
              <Button variant="outline" size="sm" onClick={() => list.refetch()}>
                <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
              </Button>
              <div className="ml-auto">
                <Button
                  size="sm"
                  onClick={() => syncAllMut.mutate()}
                  disabled={syncAllMut.isPending}
                >
                  {syncAllMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="mr-2 h-4 w-4" />
                  )}
                  Sincronizar pendentes (14 dias)
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Asaas ID</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      {list.isLoading ? "Carregando..." : "Nenhuma fatura."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (list.data ?? []).map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.customers?.company_name || inv.customers?.name || "—"}
                        <div className="text-xs text-muted-foreground">{inv.customers?.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{inv.description}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtBRL(inv.amount)}</TableCell>
                      <TableCell className="text-xs">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.asaas_payment_id ? (
                          <div className="flex items-center gap-1">
                            <span>{inv.asaas_payment_id.slice(0, 14)}…</span>
                            {inv.invoice_url && (
                              <a href={inv.invoice_url} target="_blank" rel="noreferrer" className="text-primary">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!inv.asaas_payment_id || (syncOneMut.isPending && syncingId === inv.id)}
                          onClick={() => {
                            setSyncingId(inv.id);
                            syncOneMut.mutate(inv.id);
                          }}
                        >
                          {syncOneMut.isPending && syncingId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
