import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  adminListWebhookEvents,
  adminWebhookStats,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/webhooks")({ component: WebhooksPage });

function WebhooksPage() {
  const listFn = useServerFn(adminListWebhookEvents);
  const statsFn = useServerFn(adminWebhookStats);
  const [provider, setProvider] = useState<string>("asaas");
  const [processed, setProcessed] = useState<"all" | "yes" | "no" | "error">("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<any>(null);

  const stats = useQuery({
    queryKey: ["webhook-stats"],
    queryFn: () => statsFn(),
    refetchInterval: 15000,
  });
  const list = useQuery({
    queryKey: ["webhook-events", provider, processed, q],
    queryFn: () =>
      listFn({
        data: {
          provider: provider || undefined,
          processed,
          q: q || undefined,
          limit: 200,
        },
      }),
    refetchInterval: 10000,
  });

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Logs de eventos recebidos de provedores (Asaas, etc.)"
      />
      <div className="space-y-4 p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Eventos 24h" value={stats.data?.last24h ?? "—"} icon={<Clock className="h-5 w-5 text-muted-foreground" />} />
          <StatCard label="Erros 24h" value={stats.data?.errors24h ?? "—"} icon={<AlertCircle className="h-5 w-5 text-destructive" />} />
          <StatCard label="Pendentes" value={stats.data?.pending ?? "—"} icon={<Clock className="h-5 w-5 text-amber-500" />} />
          <StatCard
            label="Último recebido"
            value={
              stats.data?.lastReceivedAt
                ? new Date(stats.data.lastReceivedAt).toLocaleString("pt-BR")
                : "Nunca"
            }
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          />
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={provider || "all"} onValueChange={(v) => setProvider(v === "all" ? "" : v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos provedores</SelectItem>
                  <SelectItem value="asaas">Asaas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={processed} onValueChange={(v: any) => setProcessed(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="yes">Processados</SelectItem>
                  <SelectItem value="no">Pendentes</SelectItem>
                  <SelectItem value="error">Com erro</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar por payment_id ou event_type"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-72"
              />
              <Button variant="outline" size="sm" onClick={() => list.refetch()}>
                <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      {list.isLoading ? "Carregando..." : "Nenhum evento. Se o Asaas indica que enviou um webhook, o problema é de roteamento até este servidor (URL/firewall/token)."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (list.data ?? []).map((ev: any) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs">{new Date(ev.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="secondary">{ev.provider}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{ev.event_type}</TableCell>
                      <TableCell className="font-mono text-xs">{ev.external_id ?? "—"}</TableCell>
                      <TableCell>
                        {ev.error ? (
                          <Badge variant="destructive">Erro</Badge>
                        ) : ev.processed ? (
                          <Badge className="bg-emerald-600">OK</Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(ev)}>Ver</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Evento {detail?.event_type}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <div><strong>Data:</strong> {new Date(detail.created_at).toLocaleString("pt-BR")}</div>
              <div><strong>External ID:</strong> {detail.external_id ?? "—"}</div>
              <div><strong>Processado:</strong> {detail.processed ? `sim (${detail.processed_at ? new Date(detail.processed_at).toLocaleString("pt-BR") : ""})` : "não"}</div>
              {detail.error && (
                <div className="rounded bg-destructive/10 p-2 text-destructive">
                  <strong>Erro:</strong> {detail.error}
                </div>
              )}
              <div>
                <strong>Payload:</strong>
                <pre className="mt-1 max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
