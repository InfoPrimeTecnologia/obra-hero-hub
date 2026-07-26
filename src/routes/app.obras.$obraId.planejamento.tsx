import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarRange, KanbanSquare, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/obras/$obraId/planejamento")({
  component: PlanejamentoPage,
});

function PlanejamentoPage() {
  const { obraId } = Route.useParams();
  return (
    <div>
      <PageHeader
        title="Planejamento"
        info="Cronograma físico (Gantt) e tarefas operacionais da obra. O Gantt mostra etapas, prazos e atrasos."
        description="Cronograma físico (Gantt) e tarefas da obra"
      />
      <div className="grid gap-3 p-8 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2 text-primary">
              <CalendarRange className="h-5 w-5" />
              <h3 className="font-semibold">Cronograma (Gantt)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Visualize etapas, subetapas e prazos em linha do tempo. Permite ajustar datas e
              identificar atrasos.
            </p>
            <Button asChild>
              <Link to="/app/obras/$obraId/gantt" params={{ obraId }}>
                Abrir Gantt <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2 text-accent">
              <KanbanSquare className="h-5 w-5" />
              <h3 className="font-semibold">Tarefas (Kanban)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Quadro de tarefas operacionais da equipe — filtrado por esta obra.
            </p>
            <Button asChild variant="secondary">
              <Link to="/app/tarefas" search={{ obra: obraId } as any}>
                Abrir tarefas <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
