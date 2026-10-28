import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getTrialEligibility, startFreeTrial } from "@/lib/trial.functions";

export function FreeTrialOffer({ onStarted }: { onStarted?: () => void }) {
  const check = useServerFn(getTrialEligibility);
  const start = useServerFn(startFreeTrial);
  const [info, setInfo] = useState<{ eligible: boolean; days: number; credits: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    check().then(setInfo).catch(() => setInfo(null));
  }, [check]);

  if (!info?.eligible) return null;

  async function go() {
    setBusy(true);
    try {
      const r = await start();
      toast.success("Teste grátis ativado!", {
        description: `Acesso ao ${r.plan} até ${r.until.split("-").reverse().join("/")}.`,
      });
      if (onStarted) onStarted();
      else window.location.reload();
    } catch (e: any) {
      toast.error("Não foi possível iniciar o teste", { description: e.message });
      setInfo({ ...info!, eligible: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center sm:flex-row sm:text-left">
      <Gift className="h-8 w-8 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Teste grátis por {info.days} dias</p>
        <p className="text-xs text-muted-foreground">
          Use o plano mais completo, com {info.credits} créditos de IA, sem cartão. Um teste por e-mail.
        </p>
      </div>
      <Button onClick={go} disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Começar teste grátis
      </Button>
    </div>
  );
}
