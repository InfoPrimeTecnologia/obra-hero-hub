import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/tickets")({
  component: () => (
    <div>
      <PageHeader title="Tickets de Suporte" description="Atenda os tickets dos clientes" />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Em breve: lista de tickets com prioridade, status e thread de mensagens.
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});
