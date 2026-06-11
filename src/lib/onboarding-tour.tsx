import { createRoot } from "react-dom/client";

const TOUR_KEY = (uid?: string | null) => `mestre360.onboarding.completed.${uid ?? "anon"}`;

export function shouldShowOnboardingTour(userId?: string | null) {
  if (typeof window === "undefined") return false;
  try {
    return !window.localStorage.getItem(TOUR_KEY(userId));
  } catch {
    return false;
  }
}

export function markOnboardingDone(userId?: string | null) {
  try {
    window.localStorage.setItem(TOUR_KEY(userId), new Date().toISOString());
  } catch {
    /* ignore */
  }
}

type TourStep = {
  title: string;
  body: string;
  action?: { label: string; href: string };
};

const STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao Mestre 360 👋",
    body: "Em poucos minutos você vai configurar o essencial para começar a usar a plataforma. Vamos seguir 5 passos rápidos.",
  },
  {
    title: "1. Cadastre sua empresa",
    body: "Tudo na plataforma fica vinculado a uma empresa: obras, notas, contratos e financeiro. Comece cadastrando os dados da sua construtora.",
    action: { label: "Ir para Empresas", href: "/app/empresas" },
  },
  {
    title: "2. Crie sua primeira obra",
    body: "A obra é o centro do sistema. Orçamento, RDO, compras e relatórios são organizados por obra. Crie uma agora — você pode editar depois.",
    action: { label: "Ir para Obras", href: "/app/obras" },
  },
  {
    title: "3. Configure o financeiro",
    body: "Cadastre suas contas bancárias e a árvore de categorias (despesas/receitas). É a base para o fluxo de caixa, relatórios e DRE.",
    action: { label: "Contas bancárias", href: "/app/contas-bancarias" },
  },
  {
    title: "4. Cadastre fornecedores",
    body: "Tenha sua base de fornecedores pronta para usar nas compras: CNPJ, contato, PIX e categorias.",
    action: { label: "Ir para Fornecedores", href: "/app/fornecedores" },
  },
  {
    title: "5. Estruture o orçamento da obra",
    body: "Dentro da obra, defina as etapas (fundação, estrutura, acabamento…) com valor orçado. Toda compra futura é alocada a uma etapa — assim você acompanha Orçado x Realizado automaticamente.",
  },
  {
    title: "Pronto! 🎉",
    body: "Você está pronto para usar o Mestre 360. Sempre que precisar, acesse o Manual no menu lateral — você também pode refazer esse tour por lá.",
    action: { label: "Abrir o Manual", href: "/app/manual" },
  },
];

type Options = { force?: boolean };

let mounted = false;

export function startOnboardingTour(userId?: string | null, opts: Options = {}) {
  if (typeof document === "undefined") return;
  if (!opts.force && !shouldShowOnboardingTour(userId)) return;
  if (mounted) return;
  mounted = true;

  const host = document.createElement("div");
  host.id = "onboarding-tour-host";
  document.body.appendChild(host);

  const cleanup = () => {
    root.unmount();
    host.remove();
    mounted = false;
  };

  const root = createRoot(host);
  root.render(
    <TourModal
      onClose={(completed) => {
        if (completed) markOnboardingDone(userId);
        cleanup();
      }}
    />,
  );
}

function TourModal({ onClose }: { onClose: (completed: boolean) => void }) {
  const [step, setStep] = useStateCompat(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const next = () => {
    if (isLast) onClose(true);
    else setStep(step + 1);
  };
  const prev = () => setStep(Math.max(0, step - 1));
  const skip = () => onClose(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background:
                  i <= step ? "hsl(var(--primary))" : "hsl(var(--muted))",
                transition: "background .2s",
              }}
            />
          ))}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{current.title}</h2>
        <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.55, marginBottom: 20 }}>
          {current.body}
        </p>

        {current.action ? (
          <a
            href={current.action.href}
            onClick={() => onClose(true)}
            style={{
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: 8,
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              marginBottom: 20,
            }}
          >
            {current.action.label} →
          </a>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button
            type="button"
            onClick={skip}
            style={{
              background: "transparent",
              border: 0,
              color: "hsl(var(--muted-foreground))",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Pular tour
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst ? (
              <button
                type="button"
                onClick={prev}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "transparent",
                  color: "hsl(var(--foreground))",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Voltar
              </button>
            ) : null}
            <button
              type="button"
              onClick={next}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: 0,
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {isLast ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// tiny local useState wrapper so this file doesn't need a separate React import gymnastics
import { useState as _useState } from "react";
function useStateCompat<T>(initial: T) {
  return _useState<T>(initial);
}
