import { HardHat } from "lucide-react";

/**
 * Estados de erro/vazio do portal público da obra.
 *
 * Ficam num módulo próprio porque o code-splitter do TanStack Router não
 * consegue dividir `notFoundComponent`/`errorComponent` quando os componentes
 * são declarados no mesmo arquivo da rota (gera import quebrado e quebra o SSR).
 */
export function PortalNotFound() {
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

export function PortalError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Não foi possível carregar o portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message ?? "Erro desconhecido"}
        </p>
      </div>
    </div>
  );
}
