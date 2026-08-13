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
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{title}</h1>
        {description && (
          <div className="text-sm text-muted-foreground mt-1">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto [&>button]:w-full [&>button]:md:w-auto [&>a]:w-full [&>a>button]:w-full [&>a>button]:md:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
