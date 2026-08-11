import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useData } from "@/lib/store";
import { toast } from "sonner";
import { todayISO } from "@/lib/format";
import { INDIAN_STATES } from "@/lib/india-locations";
import { CitySelect } from "./CitySelect";
import type { Supplier } from "@/lib/types";

type FormShape = Omit<Supplier, "id" | "code" | "createdAt" | "updatedAt">;

const empty = (): FormShape => ({
  supplierName: "",
  companyName: "",
  contactPerson: "",
  phone: "",
  altPhone: "",
  email: "",
  gstNumber: "",
  panNumber: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  paymentTerms: "",
  creditDays: 30,
  preferredPaymentMethod: "",
  openingOutstanding: 0,
  openingBalanceDate: todayISO(),
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  category: "wholesaler",
  status: "active",
  archived: false,
  notes: "",
  remarks: "",
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier?: Supplier | null;
  onSaved?: (s: Supplier) => void;
  initialName?: string;
}

export function SupplierForm({ open, onOpenChange, supplier, onSaved, initialName }: Props) {
  const { addSupplier, updateSupplier, findDuplicateSupplier } = useData();
  const [form, setForm] = useState<FormShape>(empty());
  const [confirmDup, setConfirmDup] = useState<null | { field: string; name: string }>(null);

  const isEdit = !!supplier;

  // reset form whenever dialog opens or supplier changes
  useEffect(() => {
    if (!open) return;
    if (supplier) {
      const { id: _i, code: _c, createdAt: _ca, updatedAt: _ua, ...rest } = supplier;
      setForm(rest);
    } else {
      setForm({ ...empty(), supplierName: initialName ?? "", companyName: initialName ?? "" });
    }
  }, [open, supplier, initialName]);

  const set = <K extends keyof FormShape>(k: K, v: FormShape[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const doSave = () => {
    if (isEdit && supplier) {
      updateSupplier(supplier.id, form);
      toast.success("Supplier Updated Successfully");
      onSaved?.({ ...supplier, ...form });
    } else {
      const s = addSupplier(form);
      toast.success(`${s.supplierName} added`);
      onSaved?.(s);
    }
    onOpenChange(false);
  };

  const submit = () => {
    if (!form.supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    const dup = findDuplicateSupplier(
      { supplierName: form.supplierName, gstNumber: form.gstNumber, phone: form.phone },
      supplier?.id,
    );
    if (dup) {
      setConfirmDup({ field: dup.field, name: dup.supplier.supplierName });
      return;
    }
    doSave();
  };

  const title = useMemo(() => (isEdit ? `Edit ${supplier?.supplierName}` : "Add supplier"), [isEdit, supplier]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update supplier details." : "Add a new supplier to your master."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <Section title="Basic">
              <Field label="Supplier name *">
                <Input value={form.supplierName} onChange={(e) => set("supplierName", e.target.value)} />
              </Field>
              <Field label="Company name">
                <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
              </Field>
              <Field label="Contact person">
                <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
              </Field>
              <Field label="Category">
                <Select value={form.category} onValueChange={(v) => set("category", v as Supplier["category"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturer">Manufacturer</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            <Section title="Contact">
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Alternate phone">
                <Input value={form.altPhone} onChange={(e) => set("altPhone", e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v as Supplier["status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            <Section title="Tax">
              <Field label="GST number">
                <Input value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value)} />
              </Field>
              <Field label="PAN number">
                <Input value={form.panNumber} onChange={(e) => set("panNumber", e.target.value)} />
              </Field>
            </Section>

            <Section title="Address">
              <Field label="Address" full>
                <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field label="State">
                <Select value={form.state || "none"} onValueChange={(v) => { const nv = v === "none" ? "" : v; set("state", nv); set("city", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">—</SelectItem>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="City">
                <CitySelect state={form.state} value={form.city} onChange={(v) => set("city", v)} />
              </Field>
              <Field label="Pincode"><Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} /></Field>
              <Field label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
            </Section>

            <Section title="Terms & Opening Balance">
              <Field label="Payment terms">
                <Input placeholder="e.g. Net 30" value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
              </Field>
              <Field label="Credit days">
                <Input type="number" value={form.creditDays} onChange={(e) => set("creditDays", Number(e.target.value))} />
              </Field>
              <Field label="Preferred payment method">
                <Select value={form.preferredPaymentMethod || "none"} onValueChange={(v) => set("preferredPaymentMethod", v === "none" ? "" : (v as Supplier["preferredPaymentMethod"]))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Opening outstanding (₹)">
                <Input type="number" value={form.openingOutstanding} onChange={(e) => set("openingOutstanding", Number(e.target.value))} />
              </Field>
              <Field label="Opening balance date">
                <Input type="date" value={form.openingBalanceDate} onChange={(e) => set("openingBalanceDate", e.target.value)} />
              </Field>
            </Section>

            <Section title="Bank & UPI">
              <Field label="Bank name"><Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
              <Field label="Account holder"><Input value={form.accountHolderName} onChange={(e) => set("accountHolderName", e.target.value)} /></Field>
              <Field label="Account number"><Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field>
              <Field label="IFSC"><Input value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} /></Field>
              <Field label="UPI ID"><Input value={form.upiId} onChange={(e) => set("upiId", e.target.value)} /></Field>
            </Section>

            <Section title="Notes">
              <Field label="Internal notes" full>
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <Field label="Remarks" full>
                <Textarea rows={2} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </Field>
            </Section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit}>{isEdit ? "Save changes" : "Add supplier"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDup} onOpenChange={(o) => !o && setConfirmDup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This supplier already exists.</AlertDialogTitle>
            <AlertDialogDescription>
              An existing supplier <b>{confirmDup?.name}</b> matches by {confirmDup?.field}. Save
              anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDup(null);
                doSave();
              }}
            >
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
        {title}
      </h4>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
