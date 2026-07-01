import { Bell, AlertTriangle, AlertCircle, Info, Loader2, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, type Notification } from "@/lib/use-notifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { items, unreadCount, readIds, markRead, markAllRead, loading } = useNotifications();
  const navigate = useNavigate();
  const total = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Notificações"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-card">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <p className="text-sm font-semibold">
            Notificações
            {unreadCount > 0 ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {unreadCount} não lida(s)
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            {loading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
            {unreadCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllRead}>
                <CheckCheck className="mr-1 h-3 w-3" />
                Marcar todas como lidas
              </Button>
            ) : null}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {total === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação no momento.
            </div>
          ) : (
            items.map((n) => {
              const isRead = readIds.has(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    navigate({ to: n.href });
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50",
                    isRead && "opacity-60",
                  )}
                >
                  <SeverityIcon severity={n.severity} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium", isRead && "font-normal")}>{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    {n.date ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">{n.date}</p>
                    ) : null}
                  </div>
                  {!isRead ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SeverityIcon({ severity }: { severity: Notification["severity"] }) {
  const cls = "h-4 w-4 shrink-0 mt-0.5";
  if (severity === "critical") return <AlertCircle className={cn(cls, "text-destructive")} />;
  if (severity === "warning") return <AlertTriangle className={cn(cls, "text-amber-500")} />;
  return <Info className={cn(cls, "text-blue-500")} />;
}
