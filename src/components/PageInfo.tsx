import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description: string;
  className?: string;
};

/**
 * Small info icon that reveals a contextual description on hover/focus.
 * Use next to page titles on important screens.
 */
export function PageInfo({ title, description, className }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={title ? `Sobre: ${title}` : "Informações da página"}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-sm leading-relaxed">
          {title ? <div className="mb-1 font-semibold">{title}</div> : null}
          <p className="text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
