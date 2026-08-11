import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{title}</h1>
        {description && (
          <div className="text-sm text-muted-foreground mt-1">{description}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
