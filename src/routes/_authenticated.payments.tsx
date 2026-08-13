import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Trash2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { SupplierSelect } from "@/components/SupplierSelect";
import { useData } from "@/lib/store";
import type { PaymentMode } from "@/lib/types";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { payments, suppliers, bills, addPayment, deletePayment, outstandingByBill } = useData();
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",
    billId: "",
    amount: 0,
    paymentDate: todayISO(),
    mode: "bank" as PaymentMode,
    reference: "",
    remarks: "",
  });

  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.companyName])),
    [suppliers],
  );
  const billMap = useMemo(
    () => Object.fromEntries(bills.map((b) => [b.id, b.invoiceNumber])),
    [bills],
  );

  const supplierBills = useMemo(
    () =>
      form.supplierId
        ? bills.filter((b) => b.supplierId === form.supplierId && outstandingByBill(b.id) > 0)
        : [],
    [bills, form.supplierId, outstandingByBill],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments
      .filter((p) => {
        if (q &&
          !p.reference.toLowerCase().includes(q) &&
          !supplierMap[p.supplierId]?.toLowerCase().includes(q) &&
          !billMap[p.billId]?.toLowerCase().includes(q))
          return false;
        if (modeFilter !== "all" && p.mode !== modeFilter) return false;
        return true;
      })
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [payments, query, modeFilter, supplierMap, billMap]);

  const submit = async () => {
    if (isSubmitting) return;
    if (!form.supplierId || !form.billId || !form.reference) {
      toast.error("Please fill supplier, bill, and reference");
      return;
    }
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }
    const bill = bills.find((b) => b.id === form.billId);
    if (!bill) {
      toast.error("Select a valid bill");
      return;
    }
    if (form.paymentDate < bill.invoiceDate) {
      toast.error("Payment date cannot be earlier than the invoice date");
      return;
    }
    if (form.paymentDate > todayISO()) {
      toast.error("Payment date cannot be in the future");
      return;
    }
    const outstanding = outstandingByBill(bill.id);
    if (amt > outstanding + 0.01) {
      toast.error(`Amount exceeds outstanding of ${inr(outstanding)}`);
      return;
    }
    setIsSubmitting(true);
    try {
      await addPayment({
        supplierId: form.supplierId,
        billId: form.billId,
        amount: amt,
        paymentDate: form.paymentDate,
        mode: form.mode,
        reference: form.reference,
        remarks: form.remarks,
      });
      toast.success("Payment recorded");
      setForm({
        supplierId: "",
        billId: "",
        amount: 0,
        paymentDate: todayISO(),
        mode: "bank",
        reference: "",
        remarks: "",
      });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };


  const totalPaid = filtered.reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Log payments made to suppliers. Bill status updates automatically."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Record payment</DialogTitle>
                <DialogDescription>
                  Select the bill this payment is against. Outstanding updates automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier *</Label>
                    <SupplierSelect
                      value={form.supplierId}
                      onChange={(v) => setForm({ ...form, supplierId: v, billId: "" })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bill *</Label>
                    <Select
                      value={form.billId}
                      onValueChange={(v) => setForm({ ...form, billId: v })}
                      disabled={!form.supplierId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bill" />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierBills.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">No open bills</div>
                        ) : (
                          supplierBills.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.invoiceNumber} — {inr(outstandingByBill(b.id))} due
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <Input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    />
                    {form.billId && (
                      <p className="text-xs text-muted-foreground">
                        Outstanding: {inr(outstandingByBill(form.billId))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Payment date</Label>
                    <Input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select
                      value={form.mode}
                      onValueChange={(v: PaymentMode) => setForm({ ...form, mode: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference number *</Label>
                    <Input
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="e.g. NEFT-8891"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Record payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative w-full md:max-w-md md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reference, supplier, invoice..."
              className="pl-9 w-full"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="w-fit md:ml-auto">Total: {inr(totalPaid)}</Badge>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No payments yet" description="Record your first payment above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(p.paymentDate)}</TableCell>
                    <TableCell className="font-medium">{supplierMap[p.supplierId]}</TableCell>
                    <TableCell className="text-muted-foreground">{billMap[p.billId]}</TableCell>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {p.mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{inr(p.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-success/15 text-success border-success/20"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 sm:h-9 sm:w-9"
                        onClick={() => {
                          deletePayment(p.id);
                          toast.success("Payment removed");
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
