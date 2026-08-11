import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-4">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
