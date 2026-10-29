import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Estado global simples do menu lateral no celular.
let mobileOpen = false;
const listeners = new Set<() => void>();
export function setMobileNavOpen(v: boolean) {
  mobileOpen = v;
  listeners.forEach((l) => l());
}
export function useMobileNavOpen() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => mobileOpen,
    () => false,
  );
}

const asideCls = "flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground";

export function ResponsiveSidebar({ children }: { children: ReactNode }) {
  const open = useMobileNavOpen();
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <aside className={cn(asideCls, "sticky top-0 hidden shrink-0 md:flex")}>{children}</aside>
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-foreground/50 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <aside
          className={cn(
            asideCls,
            "relative h-[100dvh] max-w-[85vw] pt-safe shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-sidebar-foreground/80 hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </button>
          {children}
        </aside>
      </div>
    </>
  );
}
