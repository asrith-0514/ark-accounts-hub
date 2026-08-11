export type UserRole = "owner" | "accountant";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type SupplierCategory = "manufacturer" | "distributor" | "wholesaler" | "vendor";
export type SupplierStatus = "active" | "inactive";
export type PaymentModePref = "cash" | "upi" | "bank" | "cheque" | "";

export interface Supplier {
  id: string;
  code: string;
  supplierName: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  altPhone: string;
  email: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  paymentTerms: string;
  creditDays: number;
  preferredPaymentMethod: PaymentModePref;
  openingOutstanding: number;
  openingBalanceDate: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  category: SupplierCategory;
  status: SupplierStatus;
  archived: boolean;
  notes: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export type BillStatus = "pending" | "partial" | "paid" | "overdue";
export type GstType = "igst" | "cgst_sgst";

/** Full bill approval workflow */
export type BillWorkflowStatus =
  | "draft"
  | "pending_verification"
  | "verified"
  | "waiting_approval"
  | "approved"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export interface BillDocument {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  invoiceDate: string;
  dueDate: string;
  /** Taxable amount BEFORE discount */
  subtotal: number;
  /** Discount applied to taxable amount */
  discount: number;
  /** Taxable value AFTER discount (= subtotal - discount). GST is calculated on this. */
  taxableValue: number;
  /** Total tax amount (IGST or CGST+SGST) on taxableValue */
  gst: number;
  otherCharges: number;
  /** Editable rounding adjustment */
  roundOff: number;
  /** Grand total = taxableValue + gst + otherCharges + roundOff. Single source of truth. */
  grandTotal: number;
  /** Kept in sync with grandTotal for backward compat */
  total: number;
  gstType: GstType;
  gstRate: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  remarks?: string;
  invoicePdfName?: string;
  invoiceImageName?: string;
  document?: BillDocument;
  documents?: BillDocument[];
  status: BillStatus;
  workflowStatus: BillWorkflowStatus;
  createdAt: string;
  deletedAt?: string | null;
}

export type PaymentMode = "cash" | "upi" | "bank" | "cheque";

export interface Payment {
  id: string;
  supplierId: string;
  billId: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  reference: string;
  remarks?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type:
    | "bill_added"
    | "payment_added"
    | "supplier_added"
    | "bill_updated"
    | "supplier_updated"
    | "supplier_archived"
    | "supplier_restored"
    | "supplier_deleted"
    | "bill_deleted"
    | "payment_deleted"
    | "settings_updated"
    | "bill_status_changed";
  message: string;
  at: string;
  userName?: string;
  entityType?: string;
  entityId?: string;
}

export interface SupplierHistoryEntry {
  id: string;
  supplierId: string;
  at: string;
  user: string;
  action: string;
  details?: string;
}

export interface BillWorkflowEvent {
  id: string;
  billId: string;
  fromStatus: BillWorkflowStatus | null;
  toStatus: BillWorkflowStatus;
  userName: string;
  comment?: string;
  at: string;
}

export interface NotificationChannels {
  email: boolean;
  whatsapp: boolean;
  push: boolean;
  inApp: boolean;
}

export interface CompanySettings {
  companyName: string;
  companyState: string;
  logoDataUrl?: string;
  notifyToday: boolean;
  notifyTomorrow: boolean;
  notifyOverdue: boolean;
  theme: "light" | "dark";
  // Extended profile
  ownerName: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  city: string;
  email: string;
  phone: string;
  financialYearStart: number; // month 1-12 (default 4 = April)
  currency: string;
  invoicePrefix: string;
  defaultCreditDays: number;
  defaultGstRate: number;
  reminderDays: number[];
  notificationChannels: NotificationChannels;
}
