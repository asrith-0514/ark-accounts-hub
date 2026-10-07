import { differenceInCalendarDays, parseISO } from "date-fns";
import type { BillStatus } from "@/lib/types";

export type DueTimelineState = "upcoming" | "today" | "overdue" | "paid";

export interface DueTimeline {
  label: string;
  state: DueTimelineState;
}

export function getDueTimeline(
  dueDate: string,
  status: BillStatus,
  today = new Date(),
): DueTimeline {
  if (status === "paid") return { label: "Paid", state: "paid" };

  const due = parseISO(dueDate);
  if (Number.isNaN(due.getTime())) {
    throw new RangeError(`Invalid bill due date: ${dueDate}`);
  }

  const daysUntilDue = differenceInCalendarDays(due, today);
  if (daysUntilDue > 1) {
    return { label: `${daysUntilDue} days left`, state: "upcoming" };
  }
  if (daysUntilDue === 1) return { label: "1 day left", state: "upcoming" };
  if (daysUntilDue === 0) return { label: "Due today", state: "today" };

  const daysOverdue = Math.abs(daysUntilDue);
  return {
    label: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
    state: "overdue",
  };
}
