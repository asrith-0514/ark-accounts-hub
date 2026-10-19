import { describe, it, expect } from "vitest";
import {
  prepareSupplierBillRows,
  sanitizeFilename,
  computeBillStatus,
  type PreparedBillRow,
} from "../export-bills";
import type { Supplier, Bill, Payment } from "../types";

// 1. Test Supplier isolation
const supplierA: Supplier = {
  id: "sup-001",
  code: "SUP001",
  supplierName: "Acme Supplies",
  companyName: "Acme Supplies Pvt Ltd",
  contactPerson: "John Doe",
  phone: "9876543210",
  altPhone: "",
  email: "acme@example.com",
  gstNumber: "29AAAAA0000A1Z5",
  panNumber: "AAAAA0000A",
  address: "123 Industrial Area",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
  country: "India",
  paymentTerms: "Net 30",
  creditDays: 30,
  preferredPaymentMethod: "bank",
  openingOutstanding: 5000,
  openingBalanceDate: "2026-01-01",
  bankName: "HDFC Bank",
  accountHolderName: "Acme Supplies Pvt Ltd",
  accountNumber: "123456789",
  ifsc: "HDFC0001234",
  upiId: "acme@hdfc",
  category: "distributor",
  status: "active",
  archived: false,
  notes: "Trusted vendor",
  remarks: "Delivers on time",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const supplierB: Supplier = {
  id: "sup-002",
  code: "SUP002",
  supplierName: "Beta Distributors",
  companyName: "Beta Distributors Corp",
  contactPerson: "Jane Smith",
  phone: "9876543211",
  altPhone: "",
  email: "beta@example.com",
  gstNumber: "29BBBBB0000B1Z6",
  panNumber: "BBBBB0000B",
  address: "456 Commercial Hub",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  country: "India",
  paymentTerms: "Net 15",
  creditDays: 15,
  preferredPaymentMethod: "upi",
  openingOutstanding: 0,
  openingBalanceDate: "2026-01-01",
  bankName: "ICICI Bank",
  accountHolderName: "Beta Distributors Corp",
  accountNumber: "987654321",
  ifsc: "ICIC0001234",
  upiId: "beta@icici",
  category: "wholesaler",
  status: "active",
  archived: false,
  notes: "Secondary vendor",
  remarks: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const sampleBills: Bill[] = [
  // Supplier A - Bill 1 (Fully Paid)
  {
    id: "bill-001",
    supplierId: "sup-001",
    invoiceNumber: "INV-1001",
    invoiceDate: "2026-04-01",
    dueDate: "2026-05-01",
    subtotal: 10000,
    discount: 1000,
    taxableValue: 9000,
    gstRate: 18,
    gst: 1620,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 10620,
    total: 10620,
    gstType: "cgst_sgst",
    status: "paid",
    workflowStatus: "approved",
    remarks: "Batch 1 materials",
    createdAt: "2026-04-01T10:00:00Z",
  },
  // Supplier A - Bill 2 (Partially Paid)
  {
    id: "bill-002",
    supplierId: "sup-001",
    invoiceNumber: "INV-1002",
    invoiceDate: "2026-04-10",
    dueDate: "2026-05-10",
    subtotal: 20000,
    discount: 0,
    taxableValue: 20000,
    gstRate: 18,
    gst: 3600,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 23600,
    total: 23600,
    gstType: "cgst_sgst",
    status: "partial",
    workflowStatus: "approved",
    remarks: "Batch 2 materials",
    createdAt: "2026-04-10T10:00:00Z",
  },
  // Supplier A - Bill 3 (Overdue / Pending)
  {
    id: "bill-003",
    supplierId: "sup-001",
    invoiceNumber: "INV-1003",
    invoiceDate: "2026-03-01",
    dueDate: "2026-03-31", // Past date -> overdue
    subtotal: 5000,
    discount: 500,
    taxableValue: 4500,
    gstRate: 12,
    gst: 540,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 5040,
    total: 5040,
    gstType: "cgst_sgst",
    status: "overdue",
    workflowStatus: "approved",
    remarks: "Old stock",
    createdAt: "2026-03-01T10:00:00Z",
  },
  // Supplier A - Bill 4 (Soft-deleted - must NOT be in export)
  {
    id: "bill-004-del",
    supplierId: "sup-001",
    invoiceNumber: "INV-DELETED",
    invoiceDate: "2026-04-15",
    dueDate: "2026-05-15",
    subtotal: 1000,
    discount: 0,
    taxableValue: 1000,
    gstRate: 18,
    gst: 180,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 1180,
    total: 1180,
    gstType: "cgst_sgst",
    status: "pending",
    workflowStatus: "approved",
    deletedAt: "2026-04-16T00:00:00Z",
    remarks: "Cancelled bill",
    createdAt: "2026-04-15T10:00:00Z",
  },
  // Supplier B - Bill
  {
    id: "bill-B01",
    supplierId: "sup-002",
    invoiceNumber: "BETA-2001",
    invoiceDate: "2026-04-05",
    dueDate: "2026-04-20",
    subtotal: 50000,
    discount: 2000,
    taxableValue: 48000,
    gstRate: 18,
    gst: 8640,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 56640,
    total: 56640,
    gstType: "cgst_sgst",
    status: "pending",
    workflowStatus: "approved",
    remarks: "Supplier B only",
    createdAt: "2026-04-05T10:00:00Z",
  },
];

const samplePayments: Payment[] = [
  // Payments for bill-001 (paid in 2 parts)
  {
    id: "pay-001",
    supplierId: "sup-001",
    billId: "bill-001",
    amount: 5000,
    paymentDate: "2026-04-15",
    mode: "bank",
    reference: "TXN1001A",
    createdAt: "2026-04-15T00:00:00Z",
  },
  {
    id: "pay-002",
    supplierId: "sup-001",
    billId: "bill-001",
    amount: 5620,
    paymentDate: "2026-04-20",
    mode: "bank",
    reference: "TXN1001B",
    createdAt: "2026-04-20T00:00:00Z",
  },
  // Payment for bill-002 (partially paid)
  {
    id: "pay-003",
    supplierId: "sup-001",
    billId: "bill-002",
    amount: 10000,
    paymentDate: "2026-04-25",
    mode: "upi",
    reference: "UPI2002",
    createdAt: "2026-04-25T00:00:00Z",
  },
  // Payment for Supplier B
  {
    id: "pay-B01",
    supplierId: "sup-002",
    billId: "bill-B01",
    amount: 20000,
    paymentDate: "2026-04-25",
    mode: "bank",
    reference: "TXNB01",
    createdAt: "2026-04-25T00:00:00Z",
  },
];

describe("Supplier Bills Export Logic", () => {
  it("Supplier A export contains only Supplier A active bills", () => {
    const rowsA = prepareSupplierBillRows(supplierA, sampleBills, samplePayments);
    expect(rowsA.length).toBe(3); // 3 active bills (deleted bill excluded)
    expect(rowsA.every((r) => r.supplierName === "Acme Supplies Pvt Ltd")).toBe(true);
    expect(rowsA.every((r) => r.supplierCode === "SUP001")).toBe(true);
    expect(rowsA.some((r) => r.invoiceNumber.includes("BETA"))).toBe(false);
    expect(rowsA.some((r) => r.invoiceNumber.includes("DELETED"))).toBe(false);
  });

  it("Supplier B export contains only Supplier B bills", () => {
    const rowsB = prepareSupplierBillRows(supplierB, sampleBills, samplePayments);
    expect(rowsB.length).toBe(1);
    expect(rowsB[0].invoiceNumber).toBe("BETA-2001");
    expect(rowsB[0].supplierCode).toBe("SUP002");
  });

  it("aggregates multiple payments correctly into a single row without duplicate rows", () => {
    const rowsA = prepareSupplierBillRows(supplierA, sampleBills, samplePayments);
    const bill1Row = rowsA.find((r) => r.invoiceNumber === "INV-1001");
    expect(bill1Row).toBeDefined();
    expect(bill1Row!.finalAmount).toBe(10620);
    expect(bill1Row!.paidAmount).toBe(10620);
    expect(bill1Row!.outstandingAmount).toBe(0);
    expect(bill1Row!.status).toBe("Paid");
  });

  it("calculates partial payment and outstanding amount accurately", () => {
    const rowsA = prepareSupplierBillRows(supplierA, sampleBills, samplePayments);
    const bill2Row = rowsA.find((r) => r.invoiceNumber === "INV-1002");
    expect(bill2Row).toBeDefined();
    expect(bill2Row!.finalAmount).toBe(23600);
    expect(bill2Row!.paidAmount).toBe(10000);
    expect(bill2Row!.outstandingAmount).toBe(13600);
  });

  it("handles overdue bills correctly", () => {
    const rowsA = prepareSupplierBillRows(supplierA, sampleBills, samplePayments);
    const bill3Row = rowsA.find((r) => r.invoiceNumber === "INV-1003");
    expect(bill3Row).toBeDefined();
    expect(bill3Row!.status).toBe("Overdue");
    expect(bill3Row!.outstandingAmount).toBe(5040);
  });

  it("returns empty array for supplier with no bills", () => {
    const emptySupplier: Supplier = { ...supplierA, id: "sup-999", code: "SUP999" };
    const rowsEmpty = prepareSupplierBillRows(emptySupplier, sampleBills, samplePayments);
    expect(rowsEmpty.length).toBe(0);
  });

  it("sanitizes filenames safely with special characters", () => {
    expect(sanitizeFilename("Tata Power Ltd.")).toBe("Tata_Power_Ltd.");
    expect(sanitizeFilename("ACME / Global : Tools & Supplies <Test>*?")).toBe(
      "ACME_Global_Tools_Supplies_Test",
    );
    expect(sanitizeFilename("")).toBe("Supplier");
  });

  it("ensures all 16 required columns are present in row structure", () => {
    const rowsA = prepareSupplierBillRows(supplierA, sampleBills, samplePayments);
    const bill1Row = rowsA[0];
    const rowKeys: (keyof PreparedBillRow)[] = [
      "supplierName",
      "supplierCode",
      "invoiceNumber",
      "invoiceDate",
      "dueDate",
      "status",
      "subtotal",
      "discount",
      "taxableValue",
      "gstRate",
      "gstAmount",
      "roundOff",
      "finalAmount",
      "paidAmount",
      "outstandingAmount",
      "remarks",
    ];
    for (const key of rowKeys) {
      expect(key in bill1Row).toBe(true);
    }
  });

  it("ensures export operations are strictly read-only and immutable", () => {
    const bill1OrigCopy = JSON.stringify(sampleBills[0]);
    prepareSupplierBillRows(supplierA, sampleBills, samplePayments);
    expect(JSON.stringify(sampleBills[0])).toBe(bill1OrigCopy);
  });
});
