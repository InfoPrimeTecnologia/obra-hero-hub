import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/planos")({
  component: () => (
    <div>
      <PageHeader title="Planos" description="Cadastre e gerencie os planos comerciais" />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Em breve: cadastro de planos (mensal, trimestral, semestral, anual) com recursos.
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});
