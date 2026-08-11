import { useMemo, useState, useEffect, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Trash2,
  Upload,
  FileText,
  Pencil,
  Download,
  Eye,
  X as XIcon,
  FileImage,
  AlertTriangle,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
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
import { SupplierSelect } from "@/components/SupplierSelect";
import { useData } from "@/lib/store";
import { fmtDate, inr, todayISO, addDays, isoDate } from "@/lib/format";
import { calcBill, deriveGstType, DEFAULT_GST_RATE } from "@/lib/gst";
import type { Bill, BillDocument, BillStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bills")({
  component: BillsPage,
});

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface FormState {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  dueDateManual: boolean;
  taxable: number;
  discount: number;
  otherCharges: number;
  roundOff: number;
  remarks: string;
  documents: BillDocument[];
}

const emptyForm = (): FormState => ({
  supplierId: "",
  invoiceNumber: "",
  invoiceDate: todayISO(),
  dueDate: todayISO(),
  dueDateManual: false,
  taxable: 0,
  discount: 0,
  otherCharges: 0,
  roundOff: 0,
  remarks: "",
  documents: [],
});


function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function BillsPage() {
  const { bills, suppliers, settings, addBill, updateBill, deleteBill, outstandingByBill } =
    useData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<BillDocument | null>(null);
  const [dupConfirm, setDupConfirm] = useState<{ existing: Bill } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.companyName || s.supplierName])),
    [suppliers],
  );

  const companyState = settings.companyState || "Andhra Pradesh";
  const selectedSupplier = suppliers.find((s) => s.id === form.supplierId);

  // Auto-derive due date from invoice date + supplier creditDays (unless user overrode)
  useEffect(() => {
    if (form.dueDateManual) return;
    const cd = Number(selectedSupplier?.creditDays ?? 0);
    if (!form.invoiceDate) return;
    const due = isoDate(addDays(form.invoiceDate, cd));
    if (due !== form.dueDate) setForm((f) => ({ ...f, dueDate: due }));
  }, [form.invoiceDate, form.dueDateManual, selectedSupplier?.creditDays, form.dueDate]);

  const gstType = deriveGstType(selectedSupplier?.state || "", companyState);
  const gstRate = settings.defaultGstRate || DEFAULT_GST_RATE;
  const calc = useMemo(
    () =>
      calcBill({
        subtotal: form.taxable,
        discount: form.discount,
        otherCharges: form.otherCharges,
        roundOff: form.roundOff,
        gstType,
        gstRate,
      }),
    [form.taxable, form.discount, form.otherCharges, form.roundOff, gstType, gstRate],
  );
  const missingLocation = !!selectedSupplier && (!selectedSupplier.state || !selectedSupplier.city);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const t = todayISO();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndISO = weekEnd.toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartISO = monthStart.toISOString().slice(0, 10);

    return bills.filter((b) => {
      if (
        q &&
        !b.invoiceNumber.toLowerCase().includes(q) &&
        !supplierMap[b.supplierId]?.toLowerCase().includes(q)
      )
        return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (supplierFilter !== "all" && b.supplierId !== supplierFilter) return false;
      if (dateFilter === "today" && b.dueDate !== t) return false;
      if (dateFilter === "tomorrow" && b.dueDate !== tomorrowISO) return false;
      if (dateFilter === "week" && (b.dueDate < t || b.dueDate > weekEndISO)) return false;
      if (dateFilter === "month" && b.invoiceDate < monthStartISO) return false;
      return true;
    });
  }, [bills, query, statusFilter, supplierFilter, dateFilter, supplierMap]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (b: Bill) => {
    setEditingId(b.id);
    const docs = b.documents && b.documents.length > 0 ? b.documents : b.document ? [b.document] : [];
    setForm({
      supplierId: b.supplierId,
      invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate,
      dueDate: b.dueDate,
      dueDateManual: true,
      taxable: b.subtotal,
      discount: b.discount || 0,
      otherCharges: b.otherCharges || 0,
      roundOff: b.roundOff || 0,
      remarks: b.remarks || "",
      documents: docs,
    });

    setOpen(true);
  };

  const onFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const added: BillDocument[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only PDF, JPG, PNG or WEBP allowed`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: exceeds 20 MB limit`);
        continue;
      }
      try {
        const dataUrl = await readFile(file);
        added.push({ name: file.name, type: file.type, size: file.size, dataUrl });
      } catch {
        toast.error(`${file.name}: failed to read`);
      }
    }
    if (added.length) {
      setForm((f) => ({ ...f, documents: [...f.documents, ...added] }));
      toast.success(`${added.length} file(s) attached`);
    }
    e.target.value = "";
  };

  const removeDoc = (idx: number) =>
    setForm((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== idx) }));

  const validate = (): string | null => {
    if (!form.supplierId) return "Supplier is required";
    if (missingLocation) return "Please update supplier location (state & city) before creating this bill.";
    if (!form.invoiceNumber.trim()) return "Invoice number is required";
    if (!form.invoiceDate) return "Invoice date is required";
    if (!form.dueDate) return "Due date is required";
    if (new Date(form.dueDate) < new Date(form.invoiceDate))
      return "Due date cannot be before invoice date";
    if (Number(form.taxable) < 0) return "Taxable amount cannot be negative";
    if (Number(form.taxable) === 0) return "Taxable amount must be greater than zero";
    if (Number(form.otherCharges) < 0) return "Other charges cannot be negative";
    return null;
  };

  const findDuplicate = (): Bill | null => {
    const inv = form.invoiceNumber.trim().toLowerCase();
    return (
      bills.find(
        (b) =>
          b.id !== editingId &&
          b.supplierId === form.supplierId &&
          b.invoiceNumber.trim().toLowerCase() === inv &&
          b.invoiceDate === form.invoiceDate,
      ) || null
    );
  };

  const persist = () => {
    const b = calc;
    const firstDoc = form.documents[0];
    const payload = {
      supplierId: form.supplierId,
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      subtotal: b.subtotal,
      discount: b.discount,
      taxableValue: b.taxableValue,
      gst: b.totalTax,
      otherCharges: b.otherCharges,
      roundOff: b.roundOff,
      grandTotal: b.grandTotal,
      total: b.grandTotal,
      gstType: b.gstType,
      gstRate: b.gstRate,
      igstAmount: b.igst,
      cgstAmount: b.cgst,
      sgstAmount: b.sgst,
      remarks: form.remarks,
      workflowStatus: "approved" as const,
      document: firstDoc,
      documents: form.documents,
      invoicePdfName: firstDoc?.type === "application/pdf" ? firstDoc.name : undefined,
      invoiceImageName: firstDoc && firstDoc.type !== "application/pdf" ? firstDoc.name : undefined,
    };

    if (editingId) {
      updateBill(editingId, payload);
      toast.success("Bill updated — outstanding & reports refreshed");
    } else {
      addBill(payload);
      toast.success("Bill added — outstanding & reports refreshed");
    }
    setForm(emptyForm());
    setEditingId(null);
    setOpen(false);
    setDupConfirm(null);
  };

  const submit = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const dup = findDuplicate();
    if (dup) {
      setDupConfirm({ existing: dup });
      return;
    }
    persist();
  };

  const downloadDoc = (doc: BillDocument) => {
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Bills"
        description="All invoices from suppliers with due dates and payment status."
        actions={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setEditingId(null);
                setForm(emptyForm());
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" /> Add Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>{editingId ? "Edit purchase bill" : "Add purchase bill"}</DialogTitle>
                <DialogDescription>
                  GST auto-calculates from supplier state · Company state: {companyState}
                </DialogDescription>
              </DialogHeader>

              <div className="grid lg:grid-cols-[1fr_340px] gap-0">
                {/* LEFT — form */}
                <div className="px-6 py-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Supplier *</Label>
                      <SupplierSelect
                        value={form.supplierId}
                        onChange={(v) => setForm({ ...form, supplierId: v })}
                      />
                      {missingLocation && (
                        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>Please update supplier location (state & city) before creating this bill.</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Invoice number *</Label>
                      <Input
                        value={form.invoiceNumber}
                        onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice date *</Label>
                      <Input
                        type="date"
                        value={form.invoiceDate}
                        onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        <span>Due date *</span>
                        {form.dueDateManual && (
                          <button
                            type="button"
                            className="text-[11px] text-primary hover:underline"
                            onClick={() => setForm({ ...form, dueDateManual: false })}
                          >
                            Reset to auto
                          </button>
                        )}
                      </Label>
                      <Input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => setForm({ ...form, dueDate: e.target.value, dueDateManual: true })}
                      />
                      {!form.dueDateManual && selectedSupplier && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Info className="h-3 w-3" /> Auto: invoice date + {selectedSupplier.creditDays || 0} credit days
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Payment terms</Label>
                      <Input value={selectedSupplier?.paymentTerms || ""} readOnly disabled placeholder="From supplier" />
                    </div>

                    <div className="space-y-2">
                      <Label>State (auto)</Label>
                      <Input value={selectedSupplier?.state || ""} readOnly disabled placeholder="From supplier" />
                    </div>
                    <div className="space-y-2">
                      <Label>City (auto)</Label>
                      <Input value={selectedSupplier?.city || ""} readOnly disabled placeholder="From supplier" />
                    </div>

                    <div className="space-y-2">
                      <Label>GST type (auto)</Label>
                      <Input
                        value={
                          selectedSupplier?.state
                            ? gstType === "igst"
                              ? "Inter-State Purchase (IGST 5%)"
                              : "Local Purchase (CGST 2.5% + SGST 2.5%)"
                            : "—"
                        }
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Credit days</Label>
                      <Input value={selectedSupplier?.creditDays ?? ""} readOnly disabled placeholder="From supplier" />
                    </div>

                    <div className="space-y-2">
                      <Label>Taxable amount (₹) *</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.taxable}
                        onChange={(e) => setForm({ ...form, taxable: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.discount}
                        onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Other charges (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.otherCharges}
                        onChange={(e) => setForm({ ...form, otherCharges: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Round off (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.roundOff}
                        onChange={(e) => setForm({ ...form, roundOff: Number(e.target.value) })}
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

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" /> Upload invoice (PDF / JPG / PNG / WEBP, max 20 MB, multiple)
                    </Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      multiple
                      onChange={onFilesChange}
                    />
                    {form.documents.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {form.documents.map((doc, i) => (
                          <div key={i} className="rounded-lg border p-2.5 flex items-center gap-3">
                            {doc.type.startsWith("image/") ? (
                              <img src={doc.dataUrl} alt="preview" className="h-12 w-12 object-cover rounded border" />
                            ) : (
                              <div className="h-12 w-12 grid place-items-center rounded border bg-muted">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setPreviewDoc(doc)} title="Preview">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => downloadDoc(doc)} title="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(i)} title="Remove">
                              <XIcon className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT — sticky summary + preview */}
                <div className="border-l bg-muted/30 px-5 py-4 space-y-4 lg:sticky lg:top-0 lg:self-start lg:max-h-[92vh] lg:overflow-y-auto">
                  <div className="rounded-xl border bg-card p-4 shadow-soft space-y-2 text-sm">
                    <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Bill Calculation</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxable Amount</span>
                      <span className="font-medium tabular-nums">{inr(calc.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">(-) Discount</span>
                      <span className="font-medium tabular-nums">{inr(calc.discount)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="text-muted-foreground">Taxable Value</span>
                      <span className="font-medium tabular-nums">{inr(calc.taxableValue)}</span>
                    </div>
                    {gstType === "igst" ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IGST ({calc.gstRate}%)</span>
                        <span className="font-medium tabular-nums">{inr(calc.igst)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST ({calc.gstRate / 2}%)</span>
                          <span className="font-medium tabular-nums">{inr(calc.cgst)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SGST ({calc.gstRate / 2}%)</span>
                          <span className="font-medium tabular-nums">{inr(calc.sgst)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Other Charges</span>
                      <span className="font-medium tabular-nums">{inr(calc.otherCharges)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Round Off</span>
                      <span className="font-medium tabular-nums">{inr(calc.roundOff)}</span>
                    </div>
                    <div className="border-t pt-2 mt-1 flex justify-between items-baseline">
                      <span className="font-semibold">Grand Total</span>
                      <span className="font-bold text-lg text-primary tabular-nums">{inr(calc.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Outstanding</span>
                      <span className="font-medium tabular-nums text-warning-foreground">{inr(calc.grandTotal)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4 shadow-soft space-y-1.5 text-xs">
                    <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Invoice Preview</div>
                    <PreviewRow label="Supplier" value={selectedSupplier?.companyName || selectedSupplier?.supplierName || "—"} />
                    <PreviewRow label="Invoice #" value={form.invoiceNumber || "—"} />
                    <PreviewRow label="Invoice Date" value={form.invoiceDate ? fmtDate(form.invoiceDate) : "—"} />
                    <PreviewRow label="Due Date" value={form.dueDate ? fmtDate(form.dueDate) : "—"} />
                    <PreviewRow label="State" value={selectedSupplier?.state || "—"} />
                    <PreviewRow label="City" value={selectedSupplier?.city || "—"} />
                    <PreviewRow label="GST Type" value={gstType === "igst" ? "IGST" : "CGST + SGST"} />
                    <PreviewRow label="GST Amount" value={inr(calc.totalTax)} />
                    <PreviewRow label="Other" value={inr(calc.otherCharges)} />
                    <PreviewRow label="Round Off" value={inr(calc.roundOff)} />
                    <div className="border-t pt-1.5 mt-1 flex justify-between font-semibold">
                      <span>Grand Total</span>
                      <span className="tabular-nums">{inr(calc.grandTotal)}</span>
                    </div>
                  </div>
                </div>

              </div>

              <DialogFooter className="px-6 pb-6 pt-2 border-t bg-background">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submit}>{editingId ? "Save changes" : "Save Purchase Bill"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoices..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.companyName || s.supplierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="tomorrow">Due tomorrow</SelectItem>
              <SelectItem value="week">Due this week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">
            {filtered.length} bills
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No bills match your filters"
            description="Try clearing filters or add a new bill."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => {
                  const docs = b.documents && b.documents.length > 0 ? b.documents : b.document ? [b.document] : [];
                  const firstDoc = docs[0];
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {firstDoc ? (
                            firstDoc.type.startsWith("image/") ? (
                              <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            )
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                          )}
                          {b.invoiceNumber}
                          {docs.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">×{docs.length}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{supplierMap[b.supplierId]}</TableCell>
                      <TableCell>{fmtDate(b.invoiceDate)}</TableCell>
                      <TableCell>{fmtDate(b.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {b.gstType === "igst" ? `IGST ${b.gstRate ?? 5}%` : `CGST+SGST ${b.gstRate ?? 5}%`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{inr(b.subtotal)}</TableCell>
                      <TableCell className="text-right">{inr(b.gst)}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(b.total)}</TableCell>
                      <TableCell className="text-right font-semibold text-warning-foreground">
                        {inr(outstandingByBill(b.id))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status as BillStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {firstDoc && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewDoc(firstDoc)}
                              title="Preview document"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bill?</AlertDialogTitle>
            <AlertDialogDescription>
              Associated payments for this bill will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteBill(deleteId);
                  toast.success("Bill deleted");
                }
                setDeleteId(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!dupConfirm} onOpenChange={(o) => !o && setDupConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              This invoice already exists
            </AlertDialogTitle>
            <AlertDialogDescription>
              Invoice <strong>{dupConfirm?.existing.invoiceNumber}</strong> dated{" "}
              <strong>{dupConfirm && fmtDate(dupConfirm.existing.invoiceDate)}</strong> already exists for this supplier
              (Total {dupConfirm && inr(dupConfirm.existing.total)}). Save anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={persist}>Save anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewDoc?.name}</DialogTitle>
            <DialogDescription>Invoice document preview</DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="w-full">
              {previewDoc.type.startsWith("image/") ? (
                <img
                  src={previewDoc.dataUrl}
                  alt={previewDoc.name}
                  className="w-full h-auto max-h-[70vh] object-contain rounded border"
                />
              ) : (
                <iframe
                  src={previewDoc.dataUrl}
                  title={previewDoc.name}
                  className="w-full h-[70vh] rounded border"
                />
              )}
            </div>
          )}
          <DialogFooter>
            {previewDoc && (
              <Button variant="outline" onClick={() => downloadDoc(previewDoc)}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            )}
            <Button onClick={() => setPreviewDoc(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
