import logoUrl from "@/assets/mestre360-logo.jpeg";

export function Logo({ className = "h-10" }: { className?: string }) {
  return <img src={logoUrl} alt="Mestre 360 — Gestão 360° da sua obra" className={className} />;
}
