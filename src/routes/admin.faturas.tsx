import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/faturas")({
  component: () => (
    <div>
      <PageHeader title="Faturas" description="Acompanhe as faturas geradas pelo sistema" />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Em breve: listagem de faturas, status, link de pagamento e ações.
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});
