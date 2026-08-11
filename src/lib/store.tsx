import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Activity,
  Bill,
  BillDocument,
  BillStatus,
  CompanySettings,
  GstType,
  Payment,
  Supplier,
  SupplierCategory,
  SupplierHistoryEntry,
  SupplierStatus,
  PaymentMode,
  PaymentModePref,
} from "./types";
import { todayISO } from "./format";
import { useAuth } from "./auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface DataState {
  suppliers: Supplier[];
  bills: Bill[];
  payments: Payment[];
  activities: Activity[];
  supplierHistory: SupplierHistoryEntry[];
  settings: CompanySettings;
}

export interface DuplicateHit {
  field: "name" | "gst" | "phone";
  supplier: Supplier;
}

interface DataContextValue extends DataState {
  loading: boolean;
  addSupplier: (s: Omit<Supplier, "id" | "code" | "createdAt" | "updatedAt">) => Supplier;
  updateSupplier: (id: string, patch: Partial<Supplier>) => void;
  archiveSupplier: (id: string) => void;
  restoreSupplier: (id: string) => void;
  deleteSupplier: (id: string) => void;
  importSuppliers: (
    rows: Array<Partial<Supplier> & { supplierName: string }>,
  ) => { added: number; skipped: number };
  findDuplicateSupplier: (
    s: Pick<Supplier, "supplierName" | "gstNumber" | "phone">,
    excludeId?: string,
  ) => DuplicateHit | null;
  nextSupplierCode: () => string;

  addBill: (b: Omit<Bill, "id" | "createdAt" | "status">) => Bill;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  addPayment: (p: Omit<Payment, "id" | "createdAt">) => Payment;
  deletePayment: (id: string) => void;
  updateSettings: (patch: Partial<CompanySettings>) => void;

  outstandingByBill: (billId: string) => number;
  outstandingBySupplier: (supplierId: string) => number;
  totalOutstanding: () => number;
  resetDemoData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const BUCKET = "bill-documents";

const defaultSettings: CompanySettings = {
  companyName: "ARK Distributors",
  companyState: "Andhra Pradesh",
  notifyToday: true,
  notifyTomorrow: true,
  notifyOverdue: true,
  theme: "light",
  ownerName: "Thatavarthi Sivannarayana",
  gstNumber: "",
  panNumber: "",
  address: "",
  city: "",
  email: "",
  phone: "",
  financialYearStart: 4,
  currency: "INR",
  invoicePrefix: "INV",
  defaultCreditDays: 30,
  defaultGstRate: 5,
  reminderDays: [0, 1, 3, 7],
  notificationChannels: { email: false, whatsapp: false, push: false, inApp: true },
};


// ---------- Mappers ----------
export function mapSupplier(r: any): Supplier {
  return {
    id: r.id,
    code: r.code,
    supplierName: r.supplier_name ?? "",
    companyName: r.company_name ?? "",
    contactPerson: r.contact_person ?? "",
    phone: r.phone ?? "",
    altPhone: r.alt_phone ?? "",
    email: r.email ?? "",
    gstNumber: r.gst_number ?? "",
    panNumber: r.pan_number ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    pincode: r.pincode ?? "",
    country: r.country ?? "India",
    paymentTerms: r.payment_terms ?? "",
    creditDays: r.credit_days ?? 30,
    preferredPaymentMethod: (r.preferred_payment_method ?? "") as PaymentModePref,
    openingOutstanding: Number(r.opening_outstanding ?? 0),
    openingBalanceDate: r.opening_balance_date ?? "",
    bankName: r.bank_name ?? "",
    accountHolderName: r.account_holder_name ?? "",
    accountNumber: r.account_number ?? "",
    ifsc: r.ifsc ?? "",
    upiId: r.upi_id ?? "",
    category: (r.category ?? "wholesaler") as SupplierCategory,
    status: (r.status ?? "active") as SupplierStatus,
    archived: !!r.archived,
    notes: r.notes ?? "",
    remarks: r.remarks ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function supplierToDb(s: Partial<Supplier>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Record<keyof Supplier, string> = {
    id: "id",
    code: "code",
    supplierName: "supplier_name",
    companyName: "company_name",
    contactPerson: "contact_person",
    phone: "phone",
    altPhone: "alt_phone",
    email: "email",
    gstNumber: "gst_number",
    panNumber: "pan_number",
    address: "address",
    city: "city",
    state: "state",
    pincode: "pincode",
    country: "country",
    paymentTerms: "payment_terms",
    creditDays: "credit_days",
    preferredPaymentMethod: "preferred_payment_method",
    openingOutstanding: "opening_outstanding",
    openingBalanceDate: "opening_balance_date",
    bankName: "bank_name",
    accountHolderName: "account_holder_name",
    accountNumber: "account_number",
    ifsc: "ifsc",
    upiId: "upi_id",
    category: "category",
    status: "status",
    archived: "archived",
    notes: "notes",
    remarks: "remarks",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined) continue;
    const dbKey = map[k as keyof Supplier];
    if (!dbKey) continue;
    if (dbKey === "opening_balance_date" && !v) continue;
    out[dbKey] = v;
  }
  return out;
}

export function mapBill(r: any, documents: BillDocument[] = []): Bill {
  const subtotal = Number(r.subtotal ?? 0);
  const discount = Number(r.discount ?? 0);
  const taxableValue = r.taxable_value != null ? Number(r.taxable_value) : Math.max(0, subtotal - discount);
  const otherCharges = Number(r.other_charges ?? 0);
  const roundOff = Number(r.round_off ?? 0);
  const total = Number(r.total ?? 0);
  const grandTotal = r.grand_total != null ? Number(r.grand_total) : total;
  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    supplierId: r.supplier_id,
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    subtotal,
    discount,
    taxableValue,
    gst: Number(r.gst ?? 0),
    otherCharges,
    roundOff,
    grandTotal,
    total: grandTotal,
    gstType: (r.gst_type ?? "cgst_sgst") as GstType,
    gstRate: Number(r.gst_rate ?? 0),
    igstAmount: r.igst_amount != null ? Number(r.igst_amount) : undefined,
    cgstAmount: r.cgst_amount != null ? Number(r.cgst_amount) : undefined,
    sgstAmount: r.sgst_amount != null ? Number(r.sgst_amount) : undefined,
    remarks: r.remarks ?? undefined,
    status: (r.status ?? "pending") as BillStatus,
    workflowStatus: (r.workflow_status ?? "approved") as Bill["workflowStatus"],
    createdAt: r.created_at,
    deletedAt: r.deleted_at ?? null,
    documents,
  };
}

function billToDb(b: Partial<Bill>): Record<string, unknown> {
  const map: Record<string, string> = {
    id: "id",
    invoiceNumber: "invoice_number",
    supplierId: "supplier_id",
    invoiceDate: "invoice_date",
    dueDate: "due_date",
    subtotal: "subtotal",
    discount: "discount",
    taxableValue: "taxable_value",
    gst: "gst",
    otherCharges: "other_charges",
    roundOff: "round_off",
    grandTotal: "grand_total",
    total: "total",
    gstType: "gst_type",
    gstRate: "gst_rate",
    igstAmount: "igst_amount",
    cgstAmount: "cgst_amount",
    sgstAmount: "sgst_amount",
    remarks: "remarks",
    status: "status",
    workflowStatus: "workflow_status",
    deletedAt: "deleted_at",
    createdAt: "created_at",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    if (k === "documents" || k === "document") continue;
    const dk = map[k];
    if (dk) out[dk] = v;
  }
  return out;
}


export function mapPayment(r: any): Payment {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    billId: r.bill_id,
    amount: Number(r.amount),
    paymentDate: r.payment_date,
    mode: r.mode as PaymentMode,
    reference: r.reference ?? "",
    remarks: r.remarks ?? undefined,
    createdAt: r.created_at,
  };
}

function paymentToDb(p: Partial<Payment>): Record<string, unknown> {
  const map: Record<string, string> = {
    id: "id",
    supplierId: "supplier_id",
    billId: "bill_id",
    amount: "amount",
    paymentDate: "payment_date",
    mode: "mode",
    reference: "reference",
    remarks: "remarks",
    createdAt: "created_at",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    const dk = map[k];
    if (dk) out[dk] = v;
  }
  return out;
}

function mapSettings(r: any): CompanySettings {
  return {
    companyName: r.company_name ?? "ARK Distributors",
    companyState: r.company_state ?? "Andhra Pradesh",
    logoDataUrl: r.logo_data_url ?? undefined,
    notifyToday: !!r.notify_today,
    notifyTomorrow: !!r.notify_tomorrow,
    notifyOverdue: !!r.notify_overdue,
    theme: (r.theme ?? "light") as "light" | "dark",
    ownerName: r.owner_name ?? "Thatavarthi Sivannarayana",
    gstNumber: r.gst_number ?? "",
    panNumber: r.pan_number ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    financialYearStart: Number(r.financial_year_start ?? 4),
    currency: r.currency ?? "INR",
    invoicePrefix: r.invoice_prefix ?? "INV",
    defaultCreditDays: Number(r.default_credit_days ?? 30),
    defaultGstRate: Number(r.default_gst_rate ?? 5),
    reminderDays: Array.isArray(r.reminder_days) ? r.reminder_days : [0, 1, 3, 7],
    notificationChannels: r.notification_channels ?? { email: false, whatsapp: false, push: false, inApp: true },
  };
}


function computeStatus(bill: Bill, paid: number): BillStatus {
  if (paid >= bill.total - 0.5) return "paid";
  const overdue = new Date(bill.dueDate) < new Date(todayISO());
  if (paid > 0) return overdue && paid < bill.total ? "overdue" : "partial";
  return overdue ? "overdue" : "pending";
}

const norm = (s: string) => (s || "").trim().toLowerCase();
const digits = (s: string) => (s || "").replace(/\D+/g, "");

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
}

async function dataUrlToBlob(dataUrl: string, type: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  return new Blob([buf], { type });
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [supplierHistory, setSupplierHistory] = useState<SupplierHistoryEntry[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("theme");
      if (cached === "dark" || cached === "light") {
        return { ...defaultSettings, theme: cached as "light" | "dark" };
      }
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);
  const documentsMapRef = useRef<Map<string, BillDocument[]>>(new Map());

  const refetchAll = useCallback(async () => {
    const [sup, bl, doc, pay, act, hist, set] = await Promise.all([
      supabase.from("suppliers").select("*").order("supplier_name"),
      supabase.from("bills").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("bill_documents").select("*"),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("activities").select("*").order("at", { ascending: false }).limit(500),
      supabase.from("supplier_history").select("*").order("at", { ascending: false }).limit(1000),
      supabase.from("company_settings").select("*").eq("id", "global").maybeSingle(),
    ]);

    // Build signed URLs for documents (batch per bill)
    const docsByBill = new Map<string, BillDocument[]>();
    if (doc.data) {
      const paths = doc.data.map((d: any) => d.storage_path);
      let urlMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        signed?.forEach((s) => {
          if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
        });
      }
      for (const d of doc.data as any[]) {
        const arr = docsByBill.get(d.bill_id) ?? [];
        arr.push({
          name: d.name,
          type: d.mime_type,
          size: Number(d.size),
          dataUrl: urlMap.get(d.storage_path) ?? "",
        });
        docsByBill.set(d.bill_id, arr);
      }
    }
    documentsMapRef.current = docsByBill;

    const nextSuppliers = (sup.data ?? []).map(mapSupplier);
    const nextBills = (bl.data ?? []).map((b: any) => mapBill(b, docsByBill.get(b.id) ?? []));
    const activeBillIds = new Set(nextBills.map((b) => b.id));
    const nextPayments = (pay.data ?? []).map(mapPayment).filter((p) => activeBillIds.has(p.billId));
    const nextActivities = (act.data ?? []).map((a: any) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      at: a.at,
      userName: a.user_name ?? "System",
      entityType: a.entity_type ?? undefined,
      entityId: a.entity_id ?? undefined,
    })) as Activity[];
    const nextHistory = (hist.data ?? []).map((h: any) => ({
      id: h.id,
      supplierId: h.supplier_id,
      at: h.at,
      user: h.user_name,
      action: h.action,
      details: h.details ?? undefined,
    })) as SupplierHistoryEntry[];

    // Recompute bill statuses from payments
    const paidByBill = new Map<string, number>();
    for (const p of nextPayments) paidByBill.set(p.billId, (paidByBill.get(p.billId) ?? 0) + p.amount);
    const withStatus = nextBills.map((b) => ({ ...b, status: computeStatus(b, paidByBill.get(b.id) ?? 0) }));

    setSuppliers(nextSuppliers);
    setBills(withStatus);
    setPayments(nextPayments);
    setActivities(nextActivities);
    setSupplierHistory(nextHistory);
    if (set.data) setSettings(mapSettings(set.data));

    // Fire status updates back to DB where they diverge (best effort)
    for (const b of withStatus) {
      const original = (bl.data ?? []).find((x: any) => x.id === b.id);
      if (original && original.status !== b.status) {
        void supabase.from("bills").update({ status: b.status }).eq("id", b.id);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refetchAll().finally(() => setLoading(false));

    // Realtime sync so Owner and Accountant see live updates together.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const kick = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refetchAll(), 400);
    };
    const channel = supabase
      .channel("ark-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "suppliers" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_documents" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "supplier_history" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_settings" }, kick)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, authLoading, refetchAll]);

  useEffect(() => {
    if (settings?.theme) {
      const isDark = settings.theme === "dark";
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("theme", settings.theme);
    }
  }, [settings?.theme]);

  const value = useMemo<DataContextValue>(() => {
    const outstandingByBill = (billId: string) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) return 0;
      const paid = payments.filter((p) => p.billId === billId).reduce((a, p) => a + p.amount, 0);
      return Math.max(bill.total - paid, 0);
    };
    const outstandingBySupplier = (supplierId: string) => {
      const sup = suppliers.find((s) => s.id === supplierId);
      const opening = sup?.openingOutstanding ?? 0;
      const billsOut = bills
        .filter((b) => b.supplierId === supplierId)
        .reduce((a, b) => a + outstandingByBill(b.id), 0);
      return opening + billsOut;
    };
    const totalOutstanding = () =>
      suppliers.reduce((a, s) => (s.archived ? a : a + outstandingBySupplier(s.id)), 0);

    const nextSupplierCode = () => {
      const max = suppliers.reduce((m, s) => {
        const n = Number.parseInt(s.code?.replace(/\D+/g, "") || "0", 10);
        return Math.max(m, n);
      }, 0);
      return `SUP${String(max + 1).padStart(3, "0")}`;
    };

    const findDuplicateSupplier = (
      s: Pick<Supplier, "supplierName" | "gstNumber" | "phone">,
      excludeId?: string,
    ): DuplicateHit | null => {
      const name = norm(s.supplierName);
      const gst = norm(s.gstNumber);
      const ph = digits(s.phone);
      for (const sup of suppliers) {
        if (excludeId && sup.id === excludeId) continue;
        if (name && norm(sup.supplierName) === name) return { field: "name", supplier: sup };
        if (gst && norm(sup.gstNumber) === gst) return { field: "gst", supplier: sup };
        if (ph && digits(sup.phone) === ph) return { field: "phone", supplier: sup };
      }
      return null;
    };

    const pushActivity = async (
      type: string,
      message: string,
      opts?: { entityType?: string; entityId?: string },
    ) => {
      const local: Activity = {
        id: uid("act"),
        type: type as Activity["type"],
        message,
        at: new Date().toISOString(),
        userName: user?.name || "System",
        entityType: opts?.entityType,
        entityId: opts?.entityId,
      };
      setActivities((prev) => [local, ...prev].slice(0, 500));

      try {
        const { error } = await supabase.from("activities").insert({
          type,
          message,
          user_name: user?.name || "System",
          entity_type: opts?.entityType ?? null,
          entity_id: opts?.entityId ?? null,
        } as any);
        if (error) {
          console.error("[pushActivity] Error inserting activity:", error);
          toast.error(`Activity log error: ${error.message}`);
        }
      } catch (err) {
        console.error("[pushActivity] Exception during insert:", err);
      }
    };

    const pushHistory = async (supplierId: string, action: string, details?: string) => {
      const local: SupplierHistoryEntry = {
        id: uid("hist"),
        supplierId,
        at: new Date().toISOString(),
        user: user?.name || "System",
        action,
        details,
      };
      setSupplierHistory((prev) => [local, ...prev].slice(0, 1000));

      try {
        const { error } = await supabase.from("supplier_history").insert({
          supplier_id: supplierId,
          action,
          details: details ?? null,
          user_name: user?.name || "System",
        } as any);
        if (error) {
          console.error("[pushHistory] Error inserting supplier history:", error);
          toast.error(`Supplier history log error: ${error.message}`);
        }
      } catch (err) {
        console.error("[pushHistory] Exception during insert:", err);
      }
    };

    const pushWorkflowEvent = async (billId: string, fromStatus: string, toStatus: string, notes?: string) => {
      void supabase.from("bill_workflow_events").insert({
        bill_id: billId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: user?.id || null,
        user_name: user?.name || "System",
        notes: notes || null
      } as any);
    };

    const addSupplier: DataContextValue["addSupplier"] = (s) => {
      const code = nextSupplierCode();
      const id = uid("sup");
      const now = new Date().toISOString();
      const sup: Supplier = { ...s, id, code, createdAt: now, updatedAt: now };
      setSuppliers((prev) => [sup, ...prev]);
      void (async () => {
        const { error } = await supabase.from("suppliers").insert(supplierToDb(sup) as any);
        if (error) {
          toast.error(`Failed to save supplier: ${error.message}`);
          setSuppliers((prev) => prev.filter((x) => x.id !== id));
          return;
        }
        pushActivity("supplier_added", `Supplier ${sup.supplierName} (${code}) added`);
        pushHistory(id, "Supplier created", `${sup.supplierName} (${code})`);
      })();
      return sup;
    };

    const updateSupplier: DataContextValue["updateSupplier"] = (id, patch) => {
      void (async () => {
        const { error } = await supabase.from("suppliers").update(supplierToDb(patch) as any).eq("id", id);
        if (error) {
          toast.error(`Update failed: ${error.message}`);
          return;
        }
        setSuppliers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)),
        );
        pushActivity("supplier_updated", "Supplier updated");
        pushHistory(id, "Supplier updated", Object.keys(patch).join(", "));
      })();
    };

    const archiveSupplier: DataContextValue["archiveSupplier"] = (id) => {
      void (async () => {
        const { error } = await supabase.from("suppliers").update({ archived: true, status: "inactive" }).eq("id", id);
        if (error) {
          toast.error(`Archive failed: ${error.message}`);
          return;
        }
        setSuppliers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, archived: true, status: "inactive" as SupplierStatus } : s)),
        );
        pushActivity("supplier_archived", "Supplier archived");
        pushHistory(id, "Supplier archived");
      })();
    };

    const restoreSupplier: DataContextValue["restoreSupplier"] = (id) => {
      void (async () => {
        const { error } = await supabase.from("suppliers").update({ archived: false, status: "active" }).eq("id", id);
        if (error) {
          toast.error(`Restore failed: ${error.message}`);
          return;
        }
        setSuppliers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, archived: false, status: "active" as SupplierStatus } : s)),
        );
        pushActivity("supplier_restored", "Supplier restored");
        pushHistory(id, "Supplier restored");
      })();
    };

    const deleteSupplier: DataContextValue["deleteSupplier"] = (id) => {
      if (user?.role !== "owner") return;
      void (async () => {
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) {
          toast.error(`Delete failed: ${error.message}`);
          return;
        }
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        setBills((prev) => prev.filter((b) => b.supplierId !== id));
        setPayments((prev) => prev.filter((p) => p.supplierId !== id));
        pushActivity("supplier_deleted", "Supplier deleted permanently");
      })();
    };


    const importSuppliers: DataContextValue["importSuppliers"] = (rows) => {
      let added = 0;
      let skipped = 0;
      const now = new Date().toISOString();
      const existing = new Map(suppliers.map((s) => [norm(s.supplierName), s]));
      let counter = suppliers.reduce((m, s) => {
        const n = Number.parseInt(s.code?.replace(/\D+/g, "") || "0", 10);
        return Math.max(m, n);
      }, 0);
      const toInsert: Supplier[] = [];
      for (const r of rows) {
        const name = (r.supplierName || "").trim();
        if (!name || existing.has(norm(name))) {
          skipped++;
          continue;
        }
        counter++;
        const code = `SUP${String(counter).padStart(3, "0")}`;
        const sup: Supplier = {
          id: uid("sup"),
          code,
          supplierName: name,
          companyName: r.companyName ?? name,
          contactPerson: r.contactPerson ?? "",
          phone: r.phone ?? "",
          altPhone: r.altPhone ?? "",
          email: r.email ?? "",
          gstNumber: r.gstNumber ?? "",
          panNumber: r.panNumber ?? "",
          address: r.address ?? "",
          city: r.city ?? "",
          state: r.state ?? "",
          pincode: r.pincode ?? "",
          country: r.country ?? "India",
          paymentTerms: r.paymentTerms ?? "",
          creditDays: Number(r.creditDays ?? 30),
          preferredPaymentMethod: (r.preferredPaymentMethod ?? "") as PaymentModePref,
          openingOutstanding: Number(r.openingOutstanding ?? 0),
          openingBalanceDate: r.openingBalanceDate ?? todayISO(),
          bankName: r.bankName ?? "",
          accountHolderName: r.accountHolderName ?? "",
          accountNumber: r.accountNumber ?? "",
          ifsc: r.ifsc ?? "",
          upiId: r.upiId ?? "",
          category: (r.category ?? "wholesaler") as SupplierCategory,
          status: (r.status ?? "active") as SupplierStatus,
          archived: false,
          notes: r.notes ?? "",
          remarks: r.remarks ?? "",
          createdAt: now,
          updatedAt: now,
        };
        toInsert.push(sup);
        existing.set(norm(name), sup);
        added++;
      }
      if (toInsert.length) {
        setSuppliers((prev) => [...toInsert, ...prev]);
        void (async () => {
          const rowsDb = toInsert.map((s) => supplierToDb(s)) as any;
          const { error } = await supabase.from("suppliers").insert(rowsDb);
          if (error) {
            toast.error(`Import failed: ${error.message}`);
            void refetchAll();
          } else {
            pushActivity("supplier_added", `Imported ${added} suppliers (${skipped} skipped)`);
          }
        })();
      }
      return { added, skipped };
    };

    const uploadBillDocuments = async (billId: string, docs: BillDocument[]) => {
      const uploaded: BillDocument[] = [];
      for (const d of docs) {
        // Already uploaded (has http/signed URL) — skip
        if (!d.dataUrl?.startsWith("data:")) {
          uploaded.push(d);
          continue;
        }
        const path = `${billId}/${Date.now()}-${d.name.replace(/[^\w.\-]+/g, "_")}`;
        const blob = await dataUrlToBlob(d.dataUrl, d.type);
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
          contentType: d.type,
          upsert: false,
        });
        if (upErr) {
          toast.error(`Upload failed for ${d.name}: ${upErr.message}`);
          continue;
        }
        const { error: dbErr } = await supabase.from("bill_documents").insert({
          bill_id: billId,
          name: d.name,
          mime_type: d.type,
          size: d.size,
          storage_path: path,
        });
        if (dbErr) {
          toast.error(`Doc metadata failed: ${dbErr.message}`);
          continue;
        }
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        uploaded.push({ ...d, dataUrl: signed?.signedUrl ?? "" });
      }
      return uploaded;
    };

    const addBill: DataContextValue["addBill"] = (b) => {
      const id = uid("bill");
      const bill: Bill = { ...b, id, status: "pending", createdAt: todayISO() };
      setBills((prev) => [bill, ...prev]);
      void (async () => {
        const { error } = await supabase.from("bills").insert({ ...billToDb(bill), id } as any);
        if (error) {
          toast.error(`Failed to save bill: ${error.message}`);
          setBills((prev) => prev.filter((x) => x.id !== id));
          return;
        }
        await pushWorkflowEvent(id, "none", bill.workflowStatus);
        pushActivity("bill_added", `Bill ${bill.invoiceNumber} added`);
        pushHistory(bill.supplierId, "Invoice added", `${bill.invoiceNumber} — ₹${bill.total.toLocaleString("en-IN")}`);
        const docs = bill.documents ?? [];
        if (docs.length) {
          const stored = await uploadBillDocuments(id, docs);
          setBills((prev) => prev.map((x) => (x.id === id ? { ...x, documents: stored } : x)));
        }
      })();
      return bill;
    };

    const updateBill: DataContextValue["updateBill"] = (id, patch) => {
      void (async () => {
        const oldBill = bills.find((b) => b.id === id);
        const { error } = await supabase.from("bills").update(billToDb(patch) as any).eq("id", id);
        if (error) {
          toast.error(`Update failed: ${error.message}`);
          return;
        }
        if (patch.workflowStatus && oldBill && oldBill.workflowStatus !== patch.workflowStatus) {
          await pushWorkflowEvent(id, oldBill.workflowStatus, patch.workflowStatus);
        }
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        pushActivity("bill_updated", `Bill ${oldBill?.invoiceNumber ?? ""} updated`);
        pushHistory(oldBill?.supplierId ?? "", "Bill updated", `${oldBill?.invoiceNumber ?? ""} updated`);
        if (patch.documents) {
          const stored = await uploadBillDocuments(id, patch.documents);
          setBills((prev) => prev.map((b) => (b.id === id ? { ...b, documents: stored } : b)));
        }
      })();
    };

    const deleteBill: DataContextValue["deleteBill"] = (id) => {
      if (user?.role !== "owner") {
        toast.error("Only Owner can delete bills");
        return;
      }
      void (async () => {
        const bill = bills.find((b) => b.id === id);
        const { error } = await supabase
          .from("bills")
          .update({ deleted_at: new Date().toISOString() } as any)
          .eq("id", id);
        if (error) {
          toast.error(`Delete failed: ${error.message}`);
          return;
        }
        setBills((prev) => prev.filter((b) => b.id !== id));
        setPayments((prev) => prev.filter((p) => p.billId !== id));
        pushActivity(
          "bill_deleted",
          `Bill ${bill?.invoiceNumber ?? id} deleted`,
          { entityType: "bill", entityId: id },
        );
        pushHistory(
          bill?.supplierId ?? "",
          "Bill deleted",
          `Bill ${bill?.invoiceNumber ?? id} deleted`,
        );
      })();
    };

    const addPayment: DataContextValue["addPayment"] = (p) => {
      const id = uid("pay");
      const pay: Payment = { ...p, id, createdAt: todayISO() };
      
      void (async () => {
        const { error } = await supabase.from("payments").insert({ ...paymentToDb(pay), id } as any);
        if (error) {
          toast.error(`Payment failed: ${error.message}`);
          return;
        }
        await refetchAll();
        pushActivity("payment_added", `Payment ₹${pay.amount.toLocaleString("en-IN")} recorded`);
        pushHistory(pay.supplierId, "Payment recorded", `₹${pay.amount.toLocaleString("en-IN")} · ${pay.reference}`);
      })();
      
      return pay;
    };

    const deletePayment: DataContextValue["deletePayment"] = (id) => {
      if (user?.role !== "owner") {
        toast.error("Only Owner can delete payments");
        return;
      }
      
      void (async () => {
        const pay = payments.find((p) => p.id === id);
        const { error } = await supabase.from("payments").delete().eq("id", id);
        if (error) {
          toast.error(`Delete failed: ${error.message}`);
          return;
        }
        await refetchAll();
        pushActivity(
          "payment_deleted",
          `Payment ${pay ? "₹" + pay.amount.toLocaleString("en-IN") : id} removed`,
          { entityType: "payment", entityId: id },
        );
        if (pay) {
          pushHistory(
            pay.supplierId,
            "Payment deleted",
            `₹${pay.amount.toLocaleString("en-IN")} · ${pay.reference}`,
          );
        }
      })();
    };

    const updateSettings: DataContextValue["updateSettings"] = (patch) => {
      void (async () => {
        const db: Record<string, unknown> = {};
        if (patch.companyName !== undefined) db.company_name = patch.companyName;
        if (patch.companyState !== undefined) db.company_state = patch.companyState;
        if (patch.logoDataUrl !== undefined) db.logo_data_url = patch.logoDataUrl;
        if (patch.notifyToday !== undefined) db.notify_today = patch.notifyToday;
        if (patch.notifyTomorrow !== undefined) db.notify_tomorrow = patch.notifyTomorrow;
        if (patch.notifyOverdue !== undefined) db.notify_overdue = patch.notifyOverdue;
        if (patch.theme !== undefined) db.theme = patch.theme;

        if (Object.keys(db).length) {
          const { error } = await supabase.from("company_settings").update(db as any).eq("id", "global");
          if (error) {
            toast.error(`Failed to save settings: ${error.message}`);
            return;
          }
        }

        setSettings((prev) => ({ ...prev, ...patch }));
        pushActivity("settings_updated", `Settings updated: ${Object.keys(patch).join(", ")}`);
      })();
    };

    const resetDemoData: DataContextValue["resetDemoData"] = () => {
      toast.info("Demo reset is disabled after migrating to the cloud backend.");
    };

    return {
      suppliers,
      bills,
      payments,
      activities,
      supplierHistory,
      settings,
      loading,
      addSupplier,
      updateSupplier,
      archiveSupplier,
      restoreSupplier,
      deleteSupplier,
      importSuppliers,
      findDuplicateSupplier,
      nextSupplierCode,
      addBill,
      updateBill,
      deleteBill,
      addPayment,
      deletePayment,
      updateSettings,
      outstandingByBill,
      outstandingBySupplier,
      totalOutstanding,
      resetDemoData,
    };
  }, [suppliers, bills, payments, activities, supplierHistory, settings, loading, user, refetchAll]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be inside DataProvider");
  return ctx;
}
