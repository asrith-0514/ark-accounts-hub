import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity as ActivityIcon, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});

const TYPE_LABEL: Record<string, string> = {
  bill_added: "Bill Added",
  bill_updated: "Bill Updated",
  bill_deleted: "Bill Deleted",
  payment_added: "Payment Added",
  payment_deleted: "Payment Removed",
  supplier_added: "Supplier Added",
  supplier_updated: "Supplier Updated",
  supplier_archived: "Supplier Archived",
  supplier_restored: "Supplier Restored",
  supplier_deleted: "Supplier Deleted",
  settings_updated: "Settings Updated",
};

const TYPE_TONE: Record<string, string> = {
  bill_added: "bg-primary/10 text-primary border-primary/20",
  bill_updated: "bg-info/15 text-info border-info/20",
  bill_deleted: "bg-destructive/15 text-destructive border-destructive/20",
  payment_added: "bg-success/15 text-success border-success/20",
  payment_deleted: "bg-destructive/15 text-destructive border-destructive/20",
  supplier_added: "bg-primary/10 text-primary border-primary/20",
  supplier_updated: "bg-info/15 text-info border-info/20",
  supplier_archived: "bg-warning/20 text-warning-foreground border-warning/30",
  supplier_restored: "bg-success/15 text-success border-success/20",
  supplier_deleted: "bg-destructive/15 text-destructive border-destructive/20",
  settings_updated: "bg-muted text-muted-foreground border-border",
};

function ActivityPage() {
  const { activities } = useData();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const users = useMemo(
    () => Array.from(new Set(activities.map((a) => a.userName || "System"))).sort(),
    [activities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (userFilter !== "all" && (a.userName || "System") !== userFilter) return false;
      if (q && !a.message.toLowerCase().includes(q) && !(a.userName || "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [activities, query, typeFilter, userFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Full audit trail of every action across the application. Live updates."
        actions={
          <Badge variant="outline" className="text-sm">
            <ActivityIcon className="h-3 w-3 mr-1" /> {filtered.length} events
          </Badge>
        }
      />

      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search message or user..."
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Actions performed in the app will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Date & Time</TableHead>
                  <TableHead className="w-44">Action</TableHead>
                  <TableHead className="w-40">User</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-32">Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const d = new Date(a.at);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div>{d.toLocaleDateString("en-IN")}</div>
                        <div className="text-muted-foreground">
                          {d.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={TYPE_TONE[a.type] || "bg-muted"}
                        >
                          {TYPE_LABEL[a.type] || a.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {a.userName || "System"}
                      </TableCell>
                      <TableCell className="text-sm">{a.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {a.entityType ? `${a.entityType}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
