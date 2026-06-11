import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCredits } from "@/lib/credits.functions";
import { cn } from "@/lib/utils";

export function CreditBalanceBadge({ className }: { className?: string }) {
  const fn = useServerFn(getMyCredits);
  const { data } = useQuery({
    queryKey: ["my-credits"],
    queryFn: () => fn(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const saldo = data?.saldo ?? 0;
  const low = saldo < 5;
  return (
    <Link
      to="/app/creditos"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        low
          ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
          : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
        className,
      )}
      title="Créditos do Assistente IA"
    >
      <Coins className="h-3.5 w-3.5" />
      {saldo} crédito{saldo === 1 ? "" : "s"}
    </Link>
  );
}
