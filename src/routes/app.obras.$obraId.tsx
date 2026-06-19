import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ObraSidebar } from "@/components/app/ObraSidebar";
import { TopBar } from "@/components/app/TopBar";
import { AIAssistant } from "@/components/app/AIAssistant";
import { usePlanModules } from "@/lib/use-plan-modules";

export const Route = createFileRoute("/app/obras/$obraId")({
  component: ObraLayout,
});

function ObraLayout() {
  const { obraId } = Route.useParams();
  const { hasFeature } = usePlanModules();
  return (
    <div className="flex min-h-screen bg-background">
      <ObraSidebar obraId={obraId} />
      <main className="flex-1 overflow-auto">
        <TopBar />
        <Outlet />
      </main>
      {hasFeature("ai_assistant") ? <AIAssistant /> : null}
    </div>
  );
}
