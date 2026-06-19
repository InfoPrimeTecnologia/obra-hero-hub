import { createFileRoute } from "@tanstack/react-router";
import { Search, Construction } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/obras/$obraId/consulta")({
  component: ConsultaPage,
});

function ConsultaPage() {
  return (
    <div>
      <PageHeader
        title="Consulta de preços"
        description="Solicite cotações a múltiplos fornecedores antes de gerar uma compra"
      />
      <div className="p-8">
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <Construction className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Em construção</h3>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Em breve você poderá criar consultas de preço, enviar para fornecedores via WhatsApp/e-mail,
              comparar respostas e converter a melhor proposta em uma compra automaticamente.
            </p>
            <Button disabled>
              <Search className="mr-2 h-4 w-4" /> Nova consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
