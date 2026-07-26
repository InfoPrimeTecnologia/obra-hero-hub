import { useLocation } from "@tanstack/react-router";
import { type ReactNode } from "react";

/**
 * Wraps route content with a light fade + subtle upward slide on navigation.
 * Uses tw-animate-css utilities keyed by pathname so each route entry replays it.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      className="animate-in fade-in duration-150 ease-out motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
