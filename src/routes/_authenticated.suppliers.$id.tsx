import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link, useParams, Navigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Building2,
  FileText,
  IndianRupee,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { SupplierForm } from "@/components/SupplierForm";
import { useData, mapBill, mapPayment } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import { fmtDate, inr } from "@/lib/format";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { SupplierHistoryEntry, Bill, Payment } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  component: SupplierDetailPage,
});

function SupplierDetailPage() {
  const { id } = useParams({ from: "/_authenticated/suppliers/$id" });
  const {
    suppliers,
    bills,
    payments,
    supplierHistory,
    outstandingBySupplier,
    outstandingByBill,
    archiveSupplier,
    restoreSupplier,
    deleteSupplier,
    updateSupplier,
    loading: storeLoading,
  } = useData();
  const { user } = useAuth();

  const supplier = suppliers.find((s) => s.id === id);
  console.log("[SupplierDetails] ID from URL:", id);
  console.log("[SupplierDetails] Store Loading State:", storeLoading);
  console.log("[SupplierDetails] Store Suppliers Count:", suppliers.length);
  console.log("[SupplierDetails] Match found in store:", supplier);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [remarks, setRemarks] = useState(supplier?.remarks ?? "");

  useEffect(() => {
    if (supplier) {
      setNotes(supplier.notes ?? "");
      setRemarks(supplier.remarks ?? "");
    }
  }, [supplier]);


  const [supplierBills, setSupplierBills] = useState<Bill[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<SupplierHistoryEntry[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    let active = true;
    
    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const [bl, pay, hist] = await Promise.all([
          supabase.from("bills").select("*").eq("supplier_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
          supabase.from("payments").select("*").eq("supplier_id", id).order("created_at", { ascending: false }),
          supabase.from("supplier_history").select("*").eq("supplier_id", id).order("at", { ascending: false })
        ]);

        if (!active) return;

        if (bl.data) {
          setSupplierBills(bl.data.map((b: any) => mapBill(b)));
        }
        if (pay.data) {
          setSupplierPayments(pay.data.map(mapPayment));
        }
        if (hist.data) {
          setHistory(hist.data.map((h: any) => ({
            id: h.id,
            supplierId: h.supplier_id,
            at: h.at,
            user: h.user_name,
            action: h.action,
            details: h.details ?? undefined
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoadingDetails(false);
      }
    };

    void fetchDetails();

    return () => {
      active = false;
    };
  }, [id, bills, payments, supplierHistory]);

  const outstanding = supplier ? outstandingBySupplier(supplier.id) : 0;
  const totalBilled = supplierBills.reduce((a, b) => a + b.total, 0);
  const totalPaid = supplierPayments.reduce((a, p) => a + p.amount, 0);
  const pendingCount = supplierBills.filter((b) => outstandingByBill(b.id) > 0).length;
  const overdueCount = supplierBills.filter((b) => b.status === "overdue").length;
  const avgBill = supplierBills.length ? totalBilled / supplierBills.length : 0;
  const avgPayDays = (() => {
    const paid = supplierBills.filter((b) => b.status === "paid");
    if (!paid.length) return 0;
    const days = paid.map((b) => {
      const p = supplierPayments
        .filter((p) => p.billId === b.id)
        .sort((a, c) => (c.paymentDate || "").localeCompare(a.paymentDate || ""))[0];
      if (!p) return 0;
      return Math.max(
        0,
        Math.round((new Date(p.paymentDate).getTime() - new Date(b.invoiceDate).getTime()) / 86400000),
      );
    });
    return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  })();

  // Ledger rows
  const ledger = useMemo(() => {
    if (!supplier) return [];

    type Row = {
      key: string;
      date: string;
      type: string;
      invoice: string;
      debit: number;
      credit: number;
      remarks?: string;
      status?: string;
    };
    const rows: Row[] = [];
    if (supplier.openingOutstanding > 0) {
      rows.push({
        key: "opening",
        date: supplier.openingBalanceDate || supplier.createdAt,
        type: "Opening Balance",
        invoice: "—",
        debit: supplier.openingOutstanding,
        credit: 0,
        remarks: "Opening outstanding at go-live",
      });
    }
    for (const b of supplierBills) {
      rows.push({
        key: `b-${b.id}`,
        date: b.invoiceDate,
        type: "Invoice",
        invoice: b.invoiceNumber,
        debit: b.total,
        credit: 0,
        status: b.status,
        remarks: b.remarks,
      });
    }
    for (const p of supplierPayments) {
      const inv = supplierBills.find((b) => b.id === p.billId);
      rows.push({
        key: `p-${p.id}`,
        date: p.paymentDate,
        type: "Payment",
        invoice: inv?.invoiceNumber ?? "—",
        debit: 0,
        credit: p.amount,
        remarks: `${p.mode.toUpperCase()} · ${p.reference}${p.remarks ? " · " + p.remarks : ""}`,
      });
    }
    rows.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let bal = 0;
    return rows.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    });
  }, [supplier, supplierBills, supplierPayments]);

  const monthlyPurchases = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of supplierBills) {
      const k = b.invoiceDate.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + b.total);
    }
    return [...map.entries()].sort();
  }, [supplierBills]);

  const monthlyPayments = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of supplierPayments) {
      const k = p.paymentDate.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + p.amount);
    }
    return [...map.entries()].sort();
  }, [supplierPayments]);

  if (storeLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) return <Navigate to="/suppliers" replace />;


  const saveNotes = () => {
    updateSupplier(supplier.id, { notes, remarks });
    toast.success("Notes updated");
  };

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link to="/suppliers">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to suppliers
          </Link>
        </Button>
        <PageHeader
          title={supplier.supplierName}
          description={
            <span className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline" className="font-mono">{supplier.code}</Badge>
              {supplier.archived ? (
                <Badge variant="outline">Archived</Badge>
              ) : supplier.status === "active" ? (
                <Badge className="bg-success/15 text-success border-success/20" variant="outline">Active</Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              )}
              <span className="text-muted-foreground text-sm capitalize">{supplier.category}</span>
            </span>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {can(user, "edit") && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
              )}
              {supplier.archived
                ? can(user, "restore") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        restoreSupplier(supplier.id);
                        toast.success("Supplier restored");
                      }}
                    >
                      <ArchiveRestore className="h-4 w-4 mr-2" /> Restore
                    </Button>
                  )
                : can(user, "archive") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        archiveSupplier(supplier.id);
                        toast.success("Supplier archived");
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" /> Archive
                    </Button>
                  )}
              {can(user, "delete") && (
                <Button variant="outline" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" /> Delete
                </Button>
              )}
              <Button asChild variant="outline"><Link to="/bills">Add Bill</Link></Button>
              <Button asChild><Link to="/payments">Add Payment</Link></Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding" value={inr(outstanding)} icon={IndianRupee} tone="warning" />
        <StatCard label="Opening Balance" value={inr(supplier.openingOutstanding)} icon={Wallet} tone="info" />
        <StatCard label="Total Billed" value={inr(totalBilled)} icon={FileText} />
        <StatCard label="Total Paid" value={inr(totalPaid)} icon={IndianRupee} tone="success" />
        <StatCard label="Pending Bills" value={pendingCount} icon={FileText} />
        <StatCard label="Overdue Bills" value={overdueCount} icon={Calendar} tone="warning" />
        <StatCard label="Avg Bill" value={inr(avgBill)} icon={TrendingUp} />
        <StatCard label="Avg Payment Days" value={`${avgPayDays} d`} icon={Calendar} tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 shadow-soft lg:col-span-1 space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Company Information</h3>
            <dl className="space-y-3 text-sm">
              <Info icon={Building2} label="Company">{supplier.companyName || "—"}</Info>
              <Info icon={Phone} label="Phone">
                {supplier.phone || "—"}
                {supplier.altPhone && <div className="text-xs text-muted-foreground">Alt: {supplier.altPhone}</div>}
              </Info>
              <Info icon={Mail} label="Email">{supplier.email || "—"}</Info>
              <Info icon={MapPin} label="Address">
                {supplier.address || "—"}
                {(supplier.city || supplier.state || supplier.pincode) && (
                  <div className="text-xs text-muted-foreground">
                    {[supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(", ")}
                  </div>
                )}
              </Info>
              <Info icon={FileText} label="Tax">
                <span className="font-mono text-xs">GST: {supplier.gstNumber || "—"}</span>
                <div className="font-mono text-xs">PAN: {supplier.panNumber || "—"}</div>
              </Info>
              <Info icon={CreditCard} label="Bank">
                {supplier.bankName || "—"}
                {supplier.accountNumber && (
                  <div className="text-xs text-muted-foreground font-mono">
                    A/c {supplier.accountNumber} · {supplier.ifsc}
                  </div>
                )}
                {supplier.upiId && <div className="text-xs text-muted-foreground">UPI: {supplier.upiId}</div>}
              </Info>
              <Info icon={Calendar} label="Terms">
                {supplier.paymentTerms || "—"} · {supplier.creditDays} credit days
              </Info>
            </dl>
          </div>
        </Card>

        <Card className="p-5 shadow-soft lg:col-span-2">
          <Tabs defaultValue="ledger">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
              <TabsTrigger value="bills">Bills ({supplierBills.length})</TabsTrigger>
              <TabsTrigger value="payments">Payments ({supplierPayments.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="ledger" className="mt-4">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ledger.length === 0 ? (
                <EmptyState title="No transactions yet" description="Add a bill or payment to build the ledger." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                          <TableCell>{r.type}</TableCell>
                          <TableCell className="font-mono text-xs">{r.invoice}</TableCell>
                          <TableCell className="text-right">{r.debit ? inr(r.debit) : "—"}</TableCell>
                          <TableCell className="text-right">{r.credit ? inr(r.credit) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{inr(r.balance)}</TableCell>
                          <TableCell>
                            {r.status ? <StatusBadge status={r.status as never} /> : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                            {r.remarks || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bills" className="mt-4">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : supplierBills.length === 0 ? (
                <EmptyState title="No bills yet" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierBills.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.invoiceNumber}</TableCell>
                          <TableCell>{fmtDate(b.invoiceDate)}</TableCell>
                          <TableCell>{fmtDate(b.dueDate)}</TableCell>
                          <TableCell className="text-right">{inr(b.total)}</TableCell>
                          <TableCell className="text-right font-semibold">{inr(outstandingByBill(b.id))}</TableCell>
                          <TableCell><StatusBadge status={b.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : supplierPayments.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{fmtDate(p.paymentDate)}</TableCell>
                          <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                          <TableCell><Badge variant="outline" className="uppercase text-[10px]">{p.mode}</Badge></TableCell>
                          <TableCell className="text-right font-semibold">{inr(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <EmptyState title="No history yet" description="Actions on this supplier will appear here." />
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {history.map((h) => (
                    <li key={h.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{h.user}</Badge>
                        <span>
                          {new Date(h.at).toLocaleDateString("en-IN")}{" "}
                          {new Date(h.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 font-medium">{h.action}</p>
                      {h.details && <p className="text-xs text-muted-foreground">{h.details}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Internal notes</Label>
                <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Monthly purchases</p>
                  {monthlyPurchases.length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    <ul className="text-sm">
                      {monthlyPurchases.map(([m, v]) => (
                        <li key={m} className="flex justify-between"><span>{m}</span><span className="font-medium">{inr(v)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly payments</p>
                  {monthlyPayments.length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    <ul className="text-sm">
                      {monthlyPayments.map(([m, v]) => (
                        <li key={m} className="flex justify-between"><span>{m}</span><span className="font-medium">{inr(v)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {can(user, "edit") && <Button onClick={saveNotes}>Save notes</Button>}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <SupplierForm open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the supplier and all their bills and payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                deleteSupplier(supplier.id);
                toast.success("Supplier deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Building2;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="font-medium break-words">{children}</dd>
      </div>
    </div>
  );
}
