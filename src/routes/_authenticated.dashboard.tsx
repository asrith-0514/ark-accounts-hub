import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wallet,
  Clock,
  AlertTriangle,
  CalendarCheck,
  FileText,
  IndianRupee,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { fmtDate, inr, inrCompact, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { suppliers, bills, payments, activities, outstandingByBill } = useData();

  const stats = useMemo(() => {
    const t = todayISO();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthISO = monthStart.toISOString().slice(0, 10);

    let outstanding = 0;
    let dueToday = 0;
    let dueTomorrow = 0;
    let overdue = 0;
    for (const b of bills) {
      const out = outstandingByBill(b.id);
      if (out <= 0) continue;
      outstanding += out;
      if (b.dueDate === t) dueToday += out;
      else if (b.dueDate === tomorrowISO) dueTomorrow += out;
      else if (b.dueDate < t) overdue += out;
    }
    const billsThisMonth = bills.filter((b) => b.createdAt >= monthISO).length;
    const paymentsThisMonth = payments
      .filter((p) => p.paymentDate >= monthISO)
      .reduce((a, p) => a + p.amount, 0);

    return {
      outstanding,
      dueToday,
      dueTomorrow,
      overdue,
      billsThisMonth,
      paymentsThisMonth,
    };
  }, [bills, payments, outstandingByBill]);

  const upcoming = useMemo(() => {
    const t = todayISO();
    return bills
      .map((b) => ({ ...b, outstanding: outstandingByBill(b.id) }))
      .filter((b) => b.outstanding > 0 && b.dueDate >= t)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
  }, [bills, outstandingByBill]);

  const recentPayments = useMemo(
    () =>
      [...payments]
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        .slice(0, 5),
    [payments],
  );

  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.companyName || s.supplierName])),
    [suppliers],
  );

  // Charts data
  const trend = useMemo(() => {
    const arr: { label: string; outstanding: number; payments: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
      const outstanding = bills
        .filter((b) => b.invoiceDate <= monthEnd)
        .reduce((sum, b) => {
          const paidBy = payments
            .filter((p) => p.billId === b.id && p.paymentDate <= monthEnd)
            .reduce((a, p) => a + p.amount, 0);
          return sum + Math.max(b.total - paidBy, 0);
        }, 0);
      const pay = payments
        .filter((p) => p.paymentDate >= monthStart && p.paymentDate <= monthEnd)
        .reduce((a, p) => a + p.amount, 0);
      arr.push({ label, outstanding, payments: pay });
    }
    return arr;
  }, [bills, payments]);

  const supplierWise = useMemo(
    () =>
      suppliers
        .map((s) => ({
          name: (s.companyName || s.supplierName).split(" ").slice(0, 2).join(" "),
          value: bills
            .filter((b) => b.supplierId === s.id)
            .reduce((a, b) => a + outstandingByBill(b.id), 0),
        }))
        .filter((s) => s.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [suppliers, bills, outstandingByBill],
  );

  const monthlyPurchase = useMemo(() => {
    const arr: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      const ms = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const me = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const value = bills
        .filter((b) => b.invoiceDate >= ms && b.invoiceDate <= me)
        .reduce((a, b) => a + b.total, 0);
      arr.push({ label, value });
    }
    return arr;
  }, [bills]);

  const pieColors = ["#3b5bdb", "#5c7cfa", "#748ffc", "#91a7ff", "#bac8ff"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview as of ${fmtDate(new Date())}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Outstanding"
          value={inrCompact(stats.outstanding)}
          icon={Wallet}
          hint={`${bills.filter((b) => outstandingByBill(b.id) > 0).length} open bills`}
        />
        <StatCard
          label="Due Today"
          value={inrCompact(stats.dueToday)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Due Tomorrow"
          value={inrCompact(stats.dueTomorrow)}
          icon={CalendarCheck}
          tone="info"
        />
        <StatCard
          label="Overdue"
          value={inrCompact(stats.overdue)}
          icon={AlertTriangle}
          tone="destructive"
        />
        <StatCard
          label="Bills This Month"
          value={stats.billsThisMonth}
          icon={FileText}
          hint="new invoices recorded"
        />
        <StatCard
          label="Payments This Month"
          value={inrCompact(stats.paymentsThisMonth)}
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          label="Active Suppliers"
          value={suppliers.length}
          icon={TrendingUp}
          tone="info"
        />
        <StatCard
          label="Total Bills"
          value={bills.length}
          icon={FileText}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Outstanding vs Payments</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b5bdb" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b5bdb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => inrCompact(v)}
                />
                <Tooltip
                  formatter={(v: number) => inr(v)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Area
                  type="monotone"
                  dataKey="outstanding"
                  stroke="#3b5bdb"
                  strokeWidth={2}
                  fill="url(#g1)"
                  name="Outstanding"
                />
                <Area
                  type="monotone"
                  dataKey="payments"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#g2)"
                  name="Payments"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold">Top Suppliers</h3>
          <p className="text-xs text-muted-foreground">Outstanding share</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={supplierWise}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {supplierWise.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold">Monthly Payments</h3>
          <p className="text-xs text-muted-foreground mb-3">Payments made per month</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrCompact} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="payments" fill="#3b5bdb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold">Monthly Purchase Value</h3>
          <p className="text-xs text-muted-foreground mb-3">Bill totals per month</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyPurchase}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrCompact} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Upcoming Payments</h3>
            <Link to="/notifications" className="text-xs text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming dues" description="All bills are settled." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{supplierMap[b.supplierId]}</TableCell>
                      <TableCell className="text-muted-foreground">{b.invoiceNumber}</TableCell>
                      <TableCell>{fmtDate(b.dueDate)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {inr(b.outstanding)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Recent Payments</h3>
          {recentPayments.length === 0 ? (
            <EmptyState title="No payments yet" />
          ) : (
            <ul className="space-y-3">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-success/15 text-success grid place-items-center shrink-0">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{supplierMap[p.supplierId]}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(p.paymentDate)} · {p.mode.toUpperCase()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{inr(p.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Recent Activity</h3>
        {activities.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {activities.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="capitalize text-[10px]">
                  {a.type.replace("_", " ")}
                </Badge>
                <span className="flex-1">{a.message}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
