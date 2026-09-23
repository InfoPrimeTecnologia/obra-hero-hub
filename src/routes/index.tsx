import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mestre 360 — Gestão de obras" },
      {
        name: "description",
        content: "Gerencie obras, equipes, compras e finanças no Mestre 360.",
      },
      { property: "og:title", content: "Mestre 360 — Gestão de obras" },
      {
        property: "og:description",
        content: "Gerencie obras, equipes, compras e finanças no Mestre 360.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
