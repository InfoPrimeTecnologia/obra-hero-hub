import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/clientes")({
  component: () => (
    <div>
      <PageHeader title="Clientes" description="Gerencie os clientes cadastrados no sistema" />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Em breve: cadastro, listagem e detalhes de clientes com sincronização ASAAS.
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});
