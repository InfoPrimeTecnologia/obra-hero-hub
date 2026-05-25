import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/admin"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mestre 360 — Gestão 360° da sua obra" },
      {
        name: "description",
        content:
          "Painel administrativo do Mestre 360 — gestão de clientes, planos, faturas e suporte.",
      },
      { property: "og:title", content: "Mestre 360 — Gestão 360° da sua obra" },
      { property: "og:description", content: "Mestre 360 Sistema is an administrative panel for managing clients, plans, invoices, and support tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Mestre 360 — Gestão 360° da sua obra" },
      { name: "description", content: "Mestre 360 Sistema is an administrative panel for managing clients, plans, invoices, and support tickets." },
      { name: "twitter:description", content: "Mestre 360 Sistema is an administrative panel for managing clients, plans, invoices, and support tickets." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/716dd4c1-67e7-45c0-890d-24df77bbca2d/id-preview-96af39f5--051ff0fc-091e-41b7-9a92-b138f4fe3c31.lovable.app-1779741355537.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/716dd4c1-67e7-45c0-890d-24df77bbca2d/id-preview-96af39f5--051ff0fc-091e-41b7-9a92-b138f4fe3c31.lovable.app-1779741355537.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
