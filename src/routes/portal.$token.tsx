import { createFileRoute, notFound } from "@tanstack/react-router";
import { Building2, MapPin, HardHat, Calendar, TrendingUp, Camera, FileText, Ruler } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getPortalData } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/$token")({
  head: ({ loaderData }) => {
    const nome = (loaderData as any)?.obra?.name ?? "Portal da obra";
    return {
      meta: [
        { title: `${nome} — Portal do cliente | Mestre 360` },
        { name: "description", content: `Acompanhamento da obra ${nome}: avanço físico, cronograma, RDOs e medições.` },
        { name: "robots", content: "noindex,nofollow" },
      ],
    };
  },
  loader: async ({ params }) => {
    const data = await getPortalData({ data: { token: params.token } });
    if (!data?.obra) throw notFound();
    return data;
  },
  component: PortalPage,
  notFoundComponent: PortalNotFound,
  errorComponent: PortalError,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PortalNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <HardHat className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">Link inválido ou desativado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este portal não está mais disponível. Solicite um novo link ao responsável pela obra.
        </p>
      </div>
    </div>
  );
}

function PortalError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Não foi possível carregar o portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error?.message ?? "Erro desconhecido"}</p>
      </div>
    </div>
  );
}

function PortalPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(portalQuery(token));

  if (!data?.obra) return <PortalNotFound />;

  const { obra, empresa, avancoFisico, etapas, rdos, fotos, medicoes } = data;

  const fotosPorRdo = new Map<string, typeof fotos>();
  for (const f of fotos) {
    const arr = fotosPorRdo.get(f.rdo_id) ?? [];
    arr.push(f);
    fotosPorRdo.set(f.rdo_id, arr);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-5">
          {empresa?.logo_url ? (
            <img src={empresa.logo_url} alt={empresa.nome} className="h-10 w-auto" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {empresa?.nome ?? "Portal da obra"}
            </p>
            <h1 className="text-lg font-semibold">{obra.name}</h1>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">Portal do cliente</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Capa da obra */}
        <Card className="overflow-hidden">
          {obra.foto_url && (
            <div className="h-48 w-full bg-muted">
              <img src={obra.foto_url} alt={obra.name} className="h-full w-full object-cover" />
            </div>
          )}
          <CardContent className="space-y-3 p-5">
            {obra.description && (
              <p className="text-sm text-muted-foreground">{obra.description}</p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {obra.cidade && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {obra.cidade}
                </span>
              )}
              {obra.start_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Início:{" "}
                  {new Date(obra.start_date).toLocaleDateString("pt-BR")}
                </span>
              )}
              {obra.expected_end_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Previsão:{" "}
                  {new Date(obra.expected_end_date).toLocaleDateString("pt-BR")}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <HardHat className="h-4 w-4" /> Status: {obra.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Avanço físico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Avanço físico geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <p className="text-4xl font-bold tabular-nums">{avancoFisico.toFixed(1)}%</p>
              <p className="mb-2 text-sm text-muted-foreground">média das etapas</p>
            </div>
            <Progress value={avancoFisico} className="mt-3" />
          </CardContent>
        </Card>

        {/* Cronograma / etapas */}
        {etapas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cronograma por etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {etapas.map((e: any) => (
                <div key={e.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{e.nome}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Number(e.percentual ?? 0).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Number(e.percentual ?? 0)} />
                  {(e.dt_inicio_prevista || e.dt_fim_prevista) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.dt_inicio_prevista &&
                        `Início ${new Date(e.dt_inicio_prevista).toLocaleDateString("pt-BR")}`}
                      {e.dt_inicio_prevista && e.dt_fim_prevista ? " · " : ""}
                      {e.dt_fim_prevista &&
                        `Fim ${new Date(e.dt_fim_prevista).toLocaleDateString("pt-BR")}`}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* RDOs */}
        {rdos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Últimos relatórios diários (RDO)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {rdos.map((r: any) => {
                const rFotos = fotosPorRdo.get(r.id) ?? [];
                return (
                  <div key={r.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-medium">
                        {new Date(r.data).toLocaleDateString("pt-BR")}
                      </span>
                      {r.condicao && <Badge variant="outline">{r.condicao}</Badge>}
                      {r.responsavel && (
                        <span className="text-muted-foreground">Resp.: {r.responsavel}</span>
                      )}
                    </div>
                    {r.observacoes && (
                      <p className="mt-2 text-sm text-muted-foreground">{r.observacoes}</p>
                    )}
                    {rFotos.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {rFotos.slice(0, 8).map((f) => (
                          <a
                            key={f.id}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block aspect-square overflow-hidden rounded-md bg-muted"
                          >
                            <img
                              src={f.url}
                              alt={f.legenda ?? "Foto do RDO"}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            {f.legenda && (
                              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-white line-clamp-1">
                                {f.legenda}
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                    {rFotos.length === 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Camera className="h-3 w-3" /> sem fotos
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Medições */}
        {medicoes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className="h-4 w-4" /> Medições
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {medicoes.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">Medição #{m.numero}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.data).toLocaleDateString("pt-BR")} · {m.status}
                      </p>
                    </div>
                    <p className="tabular-nums font-medium">{brl(Number(m.valor_total ?? 0))}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">
          Este portal é somente-leitura e reflete os dados mais recentes registrados pela equipe.
        </p>
      </main>
    </div>
  );
}
