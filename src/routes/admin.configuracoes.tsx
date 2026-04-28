import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/configuracoes")({
  component: () => (
    <div>
      <PageHeader title="Configurações" description="Integrações, templates de mensagens e usuários admin" />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Em breve: ASAAS, WhatsApp, e-mails, templates e gestão de administradores.
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});
