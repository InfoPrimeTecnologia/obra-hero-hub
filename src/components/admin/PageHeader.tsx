import type { ReactNode } from "react";
import { PageInfo } from "@/components/PageInfo";

export function PageHeader({
  title,
  description,
  actions,
  info,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional contextual help shown as an info icon next to the title. */
  info?: string | { title?: string; description: string };
}) {
  const infoData =
    typeof info === "string" ? { description: info } : info;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-8 pb-2 md:px-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {infoData ? (
            <PageInfo title={infoData.title ?? title} description={infoData.description} />
          ) : null}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
