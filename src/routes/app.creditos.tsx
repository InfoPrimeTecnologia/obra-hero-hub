import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMyCredits,
  listCreditPackages,
  createCreditRecharge,
} from "@/lib/credits.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Coins, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/creditos")({ component: CreditosPage });

const TX_LABELS: Record<string, string> = {
  recarga: "Recarga",
  consumo: "Consumo",
  ajuste: "Ajuste",
  estorno: "Estorno",
};

function fmtBRL(v: number) {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Não foi possível carregar os dados de créditos.";
}

function CreditosPage() {
  const qc = useQueryClient();
  const getCredits = useServerFn(getMyCredits);
  const listPkgs = useServerFn(listCreditPackages);
  const recharge = useServerFn(createCreditRecharge);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const credits = useQuery({ queryKey: ["my-credits"], queryFn: () => getCredits() });
  const pkgs = useQuery({ queryKey: ["credit-packages"], queryFn: () => listPkgs() });

  const creditsError = getErrorMessage(credits.error);
  const packagesError = getErrorMessage(pkgs.error);

  const buyMut = useMutation({
    mutationFn: async (packageId: string) =>
      recharge({ data: { packageId, billingType: "PIX" } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-credits"] });
      if (res.paymentUrl) {
        window.open(res.paymentUrl, "_blank");
        toast.success("Fatura gerada", {
          description: "Abrimos a tela de pagamento em uma nova aba.",
        });
      } else {
        toast.success("Fatura gerada");
      }
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
    onSettled: () => setBuyingId(null),
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Créditos do Assistente IA</h1>
          <p className="text-sm text-muted-foreground">
            Use créditos para conversar e executar ações pelo assistente.
          </p>
        </div>
      </header>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-3">
              <Coins className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Saldo atual
              </p>
              <p className="text-3xl font-bold">
                {credits.isLoading ? "—" : credits.data?.saldo ?? 0}{" "}
                <span className="text-base font-medium text-muted-foreground">créditos</span>
              </p>
            </div>
          </div>
          <Sparkles className="h-10 w-10 text-primary/30" />
        </CardContent>
      </Card>

      {(creditsError || packagesError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar os créditos</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>
              {creditsError ? <p>Saldo/extrato: {creditsError}</p> : null}
              {packagesError ? <p>Pacotes: {packagesError}</p> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void credits.refetch();
                void pkgs.refetch();
              }}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pacotes de recarga</h2>
        {pkgs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {(pkgs.data ?? []).map((p: any) => (
              <Card
                key={p.id}
                className={cn(
                  "relative flex flex-col",
                  p.destaque && "border-primary shadow-md",
                )}
              >
                {p.destaque && (
                  <Badge className="absolute -top-2 right-3">Mais vendido</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-base">{p.nome}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div>
                    <p className="text-2xl font-bold text-primary">{p.creditos}</p>
                    <p className="text-xs text-muted-foreground">créditos</p>
                    <p className="mt-2 text-lg font-semibold">{fmtBRL(Number(p.valor_brl))}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtBRL(Number(p.valor_brl) / p.creditos)} / crédito
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setBuyingId(p.id);
                      buyMut.mutate(p.id);
                    }}
                    disabled={buyMut.isPending && buyingId === p.id}
                    className="w-full"
                  >
                    {buyMut.isPending && buyingId === p.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Recarregar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Extrato</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(credits.data?.transactions ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma transação ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  (credits.data?.transactions ?? []).map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.tipo === "recarga" ? "default" : "secondary"}>
                          {TX_LABELS[t.tipo] ?? t.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.descricao ?? "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-sm",
                          t.delta > 0 ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        {t.delta > 0 ? "+" : ""}
                        {t.delta}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{t.saldo_apos}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
