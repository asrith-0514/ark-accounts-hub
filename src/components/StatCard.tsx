import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  className?: string;
}

const toneMap = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "default", className }: Props) {
  return (
    <Card className={cn("p-5 flex items-start justify-between gap-4 shadow-soft", className)}>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight truncate">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      {Icon && (
        <div className={cn("shrink-0 grid place-items-center h-11 w-11 rounded-xl", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </Card>
  );
}
