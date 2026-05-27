import logoUrl from "@/assets/mestre360-logo-transparent.png";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /**
   * default: usa o PNG cru (texto navy, fica bom em fundos claros)
   * light: envolve em um chip branco arredondado para contraste em fundos escuros (sidebar)
   */
  variant?: "default" | "light";
};

export function Logo({ className = "h-10", variant = "default" }: LogoProps) {
  if (variant === "light") {
    return (
      <div className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-1.5 shadow-sm ring-1 ring-white/10">
        <img
          src={logoUrl}
          alt="Mestre 360 — Gestão 360° da sua obra"
          className={cn(className, "w-auto object-contain")}
        />
      </div>
    );
  }
  return (
    <img
      src={logoUrl}
      alt="Mestre 360 — Gestão 360° da sua obra"
      className={cn(className, "w-auto object-contain")}
    />
  );
}
