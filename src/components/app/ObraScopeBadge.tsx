import { HardHat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useObraSelecionada } from "@/lib/obra-context";

/**
 * Banner exibido no topo das telas filtráveis por obra.
 * Mostra a obra ativa e permite limpar o filtro.
 */
export function ObraScopeBadge() {
  const { obra, setObra } = useObraSelecionada();
  if (!obra) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <HardHat className="h-4 w-4 text-accent" />
        <span className="text-muted-foreground">Filtrado por obra:</span>
        <span className="font-medium">{obra.name}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => setObra(null)}
      >
        <X className="h-3 w-3" /> Limpar
      </Button>
    </div>
  );
}
