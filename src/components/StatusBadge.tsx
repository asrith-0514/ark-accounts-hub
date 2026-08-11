import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BillStatus } from "@/lib/types";

const map: Record<BillStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success/15 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-warning/20 text-warning-foreground border-warning/30" },
  overdue: { label: "Overdue", className: "bg-destructive/15 text-destructive border-destructive/20" },
  partial: { label: "Partial", className: "bg-orange-500/15 text-orange-600 border-orange-500/25 dark:text-orange-400" },
};

export function StatusBadge({ status }: { status: BillStatus }) {
  const cfg = map[status];
  return (
    <Badge variant="outline" className={cn("font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
