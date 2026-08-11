import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Clock,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  IndianRupee,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useData } from "@/lib/store";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Priority = "critical" | "high" | "medium" | "low";
type Item = {
  id: string;
  supplierId: string;
  supplier: string;
  invoice: string;
  dueDate: string;
  outstanding: number;
  daysDiff: number; // negative = overdue
  priority: Priority;
};
type Group = {
  key: string;
  title: string;
  description: string;
  icon: typeof Clock;
  tone: "destructive" | "warning" | "info" | "primary" | "muted";
  items: Item[];
};

const toneMap: Record<Group["tone"], string> = {
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/20 text-warning-foreground",
  info: "bg-info/15 text-info",
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
};

const priorityColor: Record<Priority, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/20",
  high: "bg-warning/20 text-warning-foreground border-warning/30",
  medium: "bg-info/15 text-info border-info/20",
  low: "bg-primary/10 text-primary border-primary/20",
};

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  return Math.round((b - a) / 86400000);
}

function NotificationsPage() {
  const { bills, suppliers, outstandingByBill } = useData();

  const groups = useMemo<Group[]>(() => {
    const t = todayISO();
    const sMap = Object.fromEntries(suppliers.map((s) => [s.id, s.companyName || s.supplierName]));

    const enriched: Item[] = bills
      .map((b) => {
        const outstanding = outstandingByBill(b.id);
        const daysDiff = daysBetween(t, b.dueDate);
        let priority: Priority = "low";
        if (daysDiff < 0) priority = "critical";
        else if (daysDiff === 0) priority = "critical";
        else if (daysDiff <= 3) priority = "high";
        else if (daysDiff <= 7) priority = "medium";
        return {
          id: b.id,
          supplierId: b.supplierId,
          supplier: sMap[b.supplierId] || "—",
          invoice: b.invoiceNumber,
          dueDate: b.dueDate,
          outstanding,
          daysDiff,
          priority,
        };
      })
      .filter((b) => b.outstanding > 0);

    return [
      {
        key: "overdue",
        title: "Overdue",
        description: "Past due date — collect immediately",
        icon: AlertTriangle,
        tone: "destructive",
        items: enriched
          .filter((b) => b.daysDiff < 0)
          .sort((a, b) => a.daysDiff - b.daysDiff),
      },
      {
        key: "today",
        title: "Due Today",
        description: "Payments due today",
        icon: Clock,
        tone: "warning",
        items: enriched.filter((b) => b.daysDiff === 0),
      },
      {
        key: "tomorrow",
        title: "Due Tomorrow",
        description: "Prepare payments for tomorrow",
        icon: CalendarCheck,
        tone: "info",
        items: enriched.filter((b) => b.daysDiff === 1),
      },
      {
        key: "3days",
        title: "Next 3 Days",
        description: "Due within 2 to 3 days",
        icon: CalendarClock,
        tone: "primary",
        items: enriched
          .filter((b) => b.daysDiff >= 2 && b.daysDiff <= 3)
          .sort((a, b) => a.daysDiff - b.daysDiff),
      },
      {
        key: "week",
        title: "This Week",
        description: "Due in 4 to 7 days",
        icon: CalendarDays,
        tone: "muted",
        items: enriched
          .filter((b) => b.daysDiff >= 4 && b.daysDiff <= 7)
          .sort((a, b) => a.daysDiff - b.daysDiff),
      },
    ];
  }, [bills, suppliers, outstandingByBill]);

  const totalAlert = groups.reduce((a, g) => a + g.items.length, 0);
  const totalDue = groups.reduce(
    (a, g) => a + g.items.reduce((x, i) => x + i.outstanding, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reminder Center"
        description="Payment reminders grouped by urgency. Live updates for all users."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {totalAlert} alerts
            </Badge>
            <Badge variant="outline" className="text-sm">
              {inr(totalDue)} due
            </Badge>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const Icon = g.icon;
          const total = g.items.reduce((a, b) => a + b.outstanding, 0);
          return (
            <Card key={g.key} className="p-5 shadow-soft flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl grid place-items-center",
                      toneMap[g.tone],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{g.title}</h3>
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{inr(total)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.items.length} bills
                  </p>
                </div>
              </div>
              {g.items.length === 0 ? (
                <EmptyState title="Nothing here" description="You're all caught up." />
              ) : (
                <ul className="space-y-2 flex-1">
                  {g.items.map((r) => {
                    const label =
                      r.daysDiff < 0
                        ? `${Math.abs(r.daysDiff)} day${Math.abs(r.daysDiff) === 1 ? "" : "s"} overdue`
                        : r.daysDiff === 0
                          ? "Due today"
                          : `In ${r.daysDiff} day${r.daysDiff === 1 ? "" : "s"}`;
                    return (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/suppliers/$id"
                            params={{ id: r.supplierId }}
                            className="font-medium truncate hover:underline block"
                          >
                            {r.supplier}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{r.invoice}</span> · Due{" "}
                            {fmtDate(r.dueDate)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] capitalize",
                                priorityColor[r.priority],
                              )}
                            >
                              {r.priority}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {label}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <p className="font-semibold">{inr(r.outstanding)}</p>
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                          >
                            <Link to="/payments">
                              <IndianRupee className="h-3 w-3 mr-1" /> Pay
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
