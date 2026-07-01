import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/obras/$obraId/compras")({
  component: ComprasLayout,
});

function ComprasLayout() {
  return <Outlet />;
}